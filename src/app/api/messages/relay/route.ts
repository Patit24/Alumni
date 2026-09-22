import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendRealtimeBroadcast } from "@/lib/realtime-broadcast";

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

    // Ensure reciprocal contact trust exists
    await Promise.all([
      db.contactTrust.upsert({
        where: { userId_contactId: { userId: user.id, contactId: recipientId } },
        update: {},
        create: { userId: user.id, contactId: recipientId, trustLevel: "CONNECTED" },
      }),
      db.contactTrust.upsert({
        where: { userId_contactId: { userId: recipientId, contactId: user.id } },
        update: {},
        create: { userId: recipientId, contactId: user.id, trustLevel: "CONNECTED" },
      }),
    ]).catch(() => {});

    // 7 days auto-expiration for undelivered encrypted payloads
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

    // Create ghost / privacy-respecting notification for recipient (zero plaintext stored!)
    const recipientSettings = await db.userPrivacySettings.findUnique({
      where: { userId: recipientId },
    });

    const isGhost = recipientSettings?.ghostNotifications !== false;
    await db.appNotification.create({
      data: {
        userId: recipientId,
        actorId: user.id,
        type: "MESSAGE",
        title: isGhost ? "New Message" : `New message from ${user.name}`,
        body: isGhost ? "You received an encrypted message." : `${user.name} sent you an end-to-end encrypted message.`,
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

    // Clean up any expired messages asynchronously
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
