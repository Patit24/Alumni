import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendRealtimeBroadcast } from "@/lib/realtime-broadcast";
import { getRelationship } from "@/lib/connection-service";

export const dynamic = "force-dynamic";

// POST /api/messages - Authoritative persistent direct message creation
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      recipientId,
      content,
      messageType = "TEXT",
      clientMsgId,
      replyToId,
      replySnippet,
      disappearingSeconds,
    } = await req.json();

    if (!recipientId || !content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "recipientId and valid content are required" },
        { status: 400 }
      );
    }

    const cleanContent = content.trim();

    // 1. Check if recipient exists
    const recipient = await db.user.findUnique({
      where: { id: recipientId },
      select: { id: true, name: true, avatarUrl: true },
    });
    if (!recipient) {
      return NextResponse.json({ error: "Recipient user not found" }, { status: 404 });
    }

    // 2. Check block status
    const isBlocked = await db.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: recipientId, blockedId: user.id },
          { blockerId: user.id, blockedId: recipientId },
        ],
      },
    });
    if (isBlocked) {
      return NextResponse.json({ error: "Cannot send message to this user" }, { status: 403 });
    }

    // 3. Verify connection relationship (Must be accepted 1st-degree friends)
    const rel = await getRelationship(user.id, recipientId);
    if (rel.status !== "CONNECTED") {
      return NextResponse.json(
        { error: "You must be connected friends before you can send messages" },
        { status: 403 }
      );
    }

    // 4. Idempotency / Deduplication check on clientMsgId
    if (clientMsgId) {
      const existing = await db.directMessage.findFirst({
        where: {
          senderId: user.id,
          clientMsgId,
        },
        include: {
          sender: {
            select: { id: true, name: true, avatarUrl: true, username: true },
          },
        },
      });
      if (existing) {
        console.log(`[MESSAGE DEDUP] Message with clientMsgId ${clientMsgId} already exists:`, existing.id);
        return NextResponse.json({ success: true, message: existing, duplicate: true });
      }
    }

    // Canonical conversation identifier
    const conversationId = [user.id, recipientId].sort().join(":");
    const expiresAt =
      disappearingSeconds && disappearingSeconds > 0
        ? new Date(Date.now() + disappearingSeconds * 1000)
        : null;

    // 5. Persist message authoritatively in the database
    const message = await db.directMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        recipientId,
        content: cleanContent,
        messageType,
        status: "SENT",
        clientMsgId: clientMsgId || null,
        replyToId: replyToId || null,
        replySnippet: replySnippet || null,
        disappearingSeconds: disappearingSeconds || null,
        expiresAt,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true, username: true },
        },
      },
    });

    console.log(`[MESSAGE SERVER CONFIRMED] Persisted direct message ${message.id} (clientMsgId: ${clientMsgId})`);

    // 6. Create app notification for recipient (non-blocking)
    db.appNotification.create({
      data: {
        userId: recipientId,
        actorId: user.id,
        type: "MESSAGE",
        title: `New message from ${user.name}`,
        body: cleanContent.length > 60 ? `${cleanContent.slice(0, 57)}...` : cleanContent,
        data: JSON.stringify({
          messageId: message.id,
          conversationId,
          senderId: user.id,
          senderName: user.name,
        }),
      },
    }).catch((e) => console.warn("AppNotification creation error:", e));

    const messagePayload = {
      id: message.id,
      clientMsgId: message.clientMsgId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.sender.name,
      senderAvatar: message.sender.avatarUrl,
      recipientId: message.recipientId,
      content: message.content,
      messageType: message.messageType,
      status: message.status,
      replyToId: message.replyToId,
      replySnippet: message.replySnippet,
      disappearingSeconds: message.disappearingSeconds,
      createdAt: message.createdAt.toISOString(),
    };

    // 7. REALTIME BROADCAST:
    // A) Broadcast to Recipient channel
    sendRealtimeBroadcast(`p2p-signal:${recipientId}`, "direct-message", {
      message: messagePayload,
    }).catch((e) => console.warn("Recipient realtime broadcast error:", e));

    // B) Broadcast to Sender's own channel (so Browser B / other active devices sync instantly!)
    sendRealtimeBroadcast(`p2p-signal:${user.id}`, "direct-message-sent", {
      message: messagePayload,
    }).catch((e) => console.warn("Sender multi-session realtime broadcast error:", e));

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Error in POST /api/messages:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

// GET /api/messages - Authoritative paginated conversation history
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const peerId = searchParams.get("peerId");
    const limitParam = parseInt(searchParams.get("limit") || "40", 10);
    const limit = Math.min(Math.max(limitParam, 10), 100);
    const before = searchParams.get("before"); // ISO date string for cursor pagination

    if (!peerId) {
      return NextResponse.json({ error: "peerId is required" }, { status: 400 });
    }

    const conversationId = [user.id, peerId].sort().join(":");

    // Fetch messages descending by createdAt to get newest first (up to limit + 1)
    const rawMessages = await db.directMessage.findMany({
      where: {
        conversationId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true, username: true },
        },
      },
    });

    const hasMore = rawMessages.length > limit;
    const paginatedMessages = hasMore ? rawMessages.slice(0, limit) : rawMessages;

    // Reverse to chronological order (oldest to newest)
    const messages = paginatedMessages.reverse().map((m) => ({
      id: m.id,
      clientMsgId: m.clientMsgId,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.sender.name,
      senderAvatar: m.sender.avatarUrl,
      recipientId: m.recipientId,
      content: m.content,
      messageType: m.messageType,
      status: m.status,
      replyToId: m.replyToId,
      replySnippet: m.replySnippet,
      disappearingSeconds: m.disappearingSeconds,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt ? m.readAt.toISOString() : null,
    }));

    // Auto-mark any incoming unread messages from this peer as READ
    const unreadIncomingIds = messages
      .filter((m) => m.senderId === peerId && m.status !== "READ")
      .map((m) => m.id);

    if (unreadIncomingIds.length > 0) {
      const readTimestamp = new Date();
      db.directMessage.updateMany({
        where: {
          id: { in: unreadIncomingIds },
          recipientId: user.id,
        },
        data: {
          status: "READ",
          readAt: readTimestamp,
        },
      }).catch((e) => console.warn("Failed to update read status:", e));

      // Broadcast read receipt to peer so their UI updates
      sendRealtimeBroadcast(`p2p-signal:${peerId}`, "message-status", {
        messageIds: unreadIncomingIds,
        status: "READ",
        recipientId: user.id,
        readAt: readTimestamp.toISOString(),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      messages,
      hasMore,
      oldestTimestamp: messages.length > 0 ? messages[0].createdAt : null,
    });
  } catch (error) {
    console.error("Error in GET /api/messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
