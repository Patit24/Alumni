import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tinoesrmhzgelxiykcgq.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DtrGzEbOc2n4oeilkvpuCQ_tj6jRqyX";

// Helper to broadcast encrypted payload over WebSocket channel
async function broadcastToRecipient(recipientId: string, event: string, payload: unknown) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const channel = supabase.channel(`p2p-signal:${recipientId}`);
    await channel.send({
      type: "broadcast",
      event,
      payload,
    });
  } catch (err) {
    console.warn("Supabase Realtime relay broadcast notice:", err);
  }
}

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

    // 7 days auto-expiration for undelivered encrypted payloads
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const queuedItem = await db.encryptedMessageQueue.create({
      data: {
        senderId: user.id,
        senderDeviceId,
        recipientId,
        recipientDeviceId: recipientDeviceId || null,
        encryptedPayload,
        messageType,
        expiresAt,
      },
    });

    // Broadcast in realtime over recipient's private WebSocket signaling channel
    await broadcastToRecipient(recipientId, "encrypted-message", {
      queueId: queuedItem.id,
      senderId: user.id,
      senderDeviceId,
      encryptedPayload,
      messageType,
      createdAt: queuedItem.createdAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      queueId: queuedItem.id,
      deliveredRealtime: true,
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
