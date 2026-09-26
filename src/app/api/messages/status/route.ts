import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendRealtimeBroadcast } from "@/lib/realtime-broadcast";

export const dynamic = "force-dynamic";

// POST /api/messages/status - Update message delivery and read status
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageIds, senderId, status = "READ" } = await req.json();

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: "messageIds array is required" }, { status: 400 });
    }

    const validStatus = status === "DELIVERED" || status === "READ" ? status : "READ";
    const readAt = validStatus === "READ" ? new Date() : undefined;

    // Update in database: only messages where the recipient is the current user
    const updated = await db.directMessage.updateMany({
      where: {
        id: { in: messageIds },
        recipientId: user.id,
      },
      data: {
        status: validStatus,
        ...(readAt ? { readAt } : {}),
      },
    });

    // Broadcast status update to sender so sender's UI updates ticks
    if (senderId) {
      sendRealtimeBroadcast(`p2p-signal:${senderId}`, "message-status", {
        messageIds,
        status: validStatus,
        recipientId: user.id,
        readAt: readAt ? readAt.toISOString() : undefined,
        timestamp: Date.now(),
      }).catch((e) => console.warn("Failed to broadcast status update:", e));
    }

    return NextResponse.json({
      success: true,
      updatedCount: updated.count,
      status: validStatus,
    });
  } catch (error) {
    console.error("Error in POST /api/messages/status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
