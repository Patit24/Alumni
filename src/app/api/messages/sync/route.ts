import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchUserStreamDeltas } from "@/lib/queue/redis-queue";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/messages/sync?cursor=... - Cursor-based delta synchronization
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const { items, nextCursor } = await fetchUserStreamDeltas(user.id, cursor, limit);

    // Automatically mark delivered messages as DELIVERED in background
    if (items.length > 0) {
      const messageIds = items.map((m) => m.id);
      db.directMessage
        .updateMany({
          where: {
            id: { in: messageIds },
            recipientId: user.id,
            status: "SENT",
          },
          data: { status: "DELIVERED" },
        })
        .catch((e) => console.warn("[Sync] Delivery status update error:", e));
    }

    return NextResponse.json({
      success: true,
      messages: items,
      nextCursor,
      count: items.length,
    });
  } catch (error) {
    console.error("Message delta sync error:", error);
    return NextResponse.json({ error: "Failed to sync message deltas" }, { status: 500 });
  }
}
