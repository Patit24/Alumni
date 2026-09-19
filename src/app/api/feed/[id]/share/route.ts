import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastFeedEvent } from "@/lib/supabase-broadcast";

export const dynamic = "force-dynamic";

// POST /api/feed/[id]/share - Record a share and optionally broadcast
export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: feedItemId } = await props.params;
    const body = await req.json().catch(() => ({}));
    const platform = body.platform || "LINK_COPY"; // "LINK_COPY", "WHATSAPP", "IN_APP"

    const feedItem = await db.feedItem.findUnique({
      where: { id: feedItemId },
      select: { id: true, institutionId: true },
    });

    if (!feedItem) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await db.postShare.create({
      data: {
        feedItemId,
        userId: user.id,
        platform,
      },
    });

    const sharesCount = await db.postShare.count({
      where: { feedItemId },
    });

    // Broadcast share update via Supabase Realtime
    await broadcastFeedEvent(feedItem.institutionId, "share-update", {
      feedItemId,
      sharesCount,
      platform,
    });

    return NextResponse.json({
      success: true,
      sharesCount,
    });
  } catch (error) {
    console.error("Share POST error:", error);
    return NextResponse.json({ error: "Failed to record share" }, { status: 500 });
  }
}
