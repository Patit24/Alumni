import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendRealtimeBroadcast } from "@/lib/realtime-broadcast";

export const dynamic = "force-dynamic";

// POST /api/messages/ack - Acknowledge delivery & purge temporary encrypted messages from server
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageIds, queueIds, senderId, status = "DELIVERED" } = await req.json();

    const idsToPurge = Array.isArray(queueIds) && queueIds.length > 0
      ? queueIds
      : Array.isArray(messageIds) ? messageIds : [];

    // 1. Permanently delete acknowledged encrypted messages from server queue
    if (idsToPurge.length > 0) {
      await db.encryptedMessageQueue.deleteMany({
        where: {
          id: { in: idsToPurge },
          recipientId: user.id,
        },
      });
    }

    // 2. Broadcast receipt back to original sender so their UI updates to Delivered/Read
    if (senderId && Array.isArray(messageIds) && messageIds.length > 0) {
      sendRealtimeBroadcast(`p2p-signal:${senderId}`, "message-status", {
        messageIds,
        status,
        recipientId: user.id,
        timestamp: Date.now(),
      }).catch((e) => console.warn("Ack broadcast error:", e));
    }

    return NextResponse.json({ success: true, purgedCount: idsToPurge.length });
  } catch (error) {
    console.error("Error in /api/messages/ack POST:", error);
    return NextResponse.json({ error: "Failed to acknowledge messages" }, { status: 500 });
  }
}
