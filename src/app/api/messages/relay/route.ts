import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendRealtimeBroadcast } from "@/lib/realtime-broadcast";
import { getRelationship } from "@/lib/connection-service";

export const dynamic = "force-dynamic";

// POST /api/messages/relay - Queue encrypted payload and broadcast via WebSocket
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      recipientId,
      recipientDeviceId,
      senderDeviceId,
      encryptedPayload,
      messageType = "TEXT",
    } = await req.json();

    if (!recipientId || !encryptedPayload || !senderDeviceId) {
      return NextResponse.json(
        { error: "recipientId, senderDeviceId, and encryptedPayload are required" },
        { status: 400 }
      );
    }

    // Check if recipient has blocked sender
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

    // Users must be accepted friends before sending messages
    const rel = await getRelationship(user.id, recipientId);
    if (rel.status !== "CONNECTED") {
      return NextResponse.json(
        { error: "You must be connected friends before you can send messages" },
        { status: 403 }
      );
    }

    // 2 days auto-expiration for undelivered encrypted payloads - automatically vanishes after 48 hours
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    // Proactively vanish any expired messages from the database
    const now = new Date();
    db.encryptedMessageQueue.deleteMany({
      where: { expiresAt: { lte: now } },
    }).catch(() => {});

    const serializedPayload =
      typeof encryptedPayload === "string"
        ? encryptedPayload
        : JSON.stringify(encryptedPayload);

    let parsedPayloadObj: any = encryptedPayload;
    if (typeof encryptedPayload === "string") {
      try {
        parsedPayloadObj = JSON.parse(encryptedPayload);
      } catch {
        parsedPayloadObj = encryptedPayload;
      }
    }

    const queuedItem = await db.encryptedMessageQueue.create({
      data: {
        senderId: user.id,
        senderDeviceId,
        recipientId,
        recipientDeviceId: recipientDeviceId || null,
        encryptedPayload: serializedPayload,
        messageType,
        expiresAt,
      },
    });

    // Create instant notification record for recipient
    await db.appNotification.create({
      data: {
        userId: recipientId,
        actorId: user.id,
        type: "MESSAGE",
        title: `New message from ${user.name}`,
        body: `${user.name} sent you a message. Tap to open chat.`,
        data: JSON.stringify({
          queueId: queuedItem.id,
          senderId: user.id,
          senderName: user.name,
        }),
      },
    }).catch(() => {});

    // Broadcast in realtime over recipient's private WebSocket signaling channel
    const deliveredRealtime = await sendRealtimeBroadcast(`p2p-signal:${recipientId}`, "encrypted-message", {
      queueId: queuedItem.id,
      senderId: user.id,
      senderName: user.name,
      senderDeviceId,
      encryptedPayload: parsedPayloadObj,
      messageType,
      createdAt: queuedItem.createdAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      queueId: queuedItem.id,
      deliveredRealtime,
    });
  } catch (error) {
    console.error("Error in /api/messages/relay POST:", error);
    return NextResponse.json({ error: "Failed to relay message" }, { status: 500 });
  }
}

// GET /api/messages/relay - Drain pending encrypted messages for the current user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Fetch undelivered messages
    const pending = await db.encryptedMessageQueue.findMany({
      where: {
        recipientId: user.id,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    // Fetch sender names for enriched notification and vault display
    const senderIds = Array.from(new Set(pending.map((p) => p.senderId)));
    const senders = await db.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, name: true },
    });
    const senderMap = new Map(senders.map((s) => [s.id, s.name]));

    // Clean up any expired messages asynchronously (older than 2 days)
    db.encryptedMessageQueue.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    }).catch((e) => console.warn("Purge expired message error:", e));

    return NextResponse.json({
      success: true,
      messages: pending.map((p) => ({
        id: p.id,
        senderId: p.senderId,
        senderName: senderMap.get(p.senderId) || "Alumni Contact",
        senderDeviceId: p.senderDeviceId,
        encryptedPayload: p.encryptedPayload,
        messageType: p.messageType,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error in /api/messages/relay GET:", error);
    return NextResponse.json({ error: "Failed to fetch queued messages" }, { status: 500 });
  }
}
