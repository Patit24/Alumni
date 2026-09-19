import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastFeedEvent } from "@/lib/supabase-broadcast";

export const dynamic = "force-dynamic";

// POST /api/feed/[id]/like - Toggle like on a feed post
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

    const feedItem = await db.feedItem.findUnique({
      where: { id: feedItemId },
      select: { id: true, institutionId: true },
    });

    if (!feedItem) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if user already liked this post
    const existingLike = await db.postLike.findUnique({
      where: {
        feedItemId_userId: {
          feedItemId,
          userId: user.id,
        },
      },
    });

    let hasLiked = false;
    if (existingLike) {
      await db.postLike.delete({
        where: { id: existingLike.id },
      });
      hasLiked = false;
    } else {
      await db.postLike.create({
        data: {
          feedItemId,
          userId: user.id,
        },
      });
      hasLiked = true;
    }

    // Get updated likes count
    const likesCount = await db.postLike.count({
      where: { feedItemId },
    });

    // Broadcast like update via Supabase Realtime
    await broadcastFeedEvent(feedItem.institutionId, "like-update", {
      feedItemId,
      likesCount,
      actorId: user.id,
    });

    return NextResponse.json({
      success: true,
      hasLiked,
      likesCount,
    });
  } catch (error) {
    console.error("Like toggle error:", error);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
