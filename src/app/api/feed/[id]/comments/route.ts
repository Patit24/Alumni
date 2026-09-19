import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastFeedEvent } from "@/lib/supabase-broadcast";

export const dynamic = "force-dynamic";

// GET /api/feed/[id]/comments - Fetch all comments for a post
export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: feedItemId } = await props.params;

    const comments = await db.postComment.findMany({
      where: { feedItemId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            batchYear: true,
            currentRole: true,
            currentCompany: true,
            verificationStatus: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error("Comments GET error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// POST /api/feed/[id]/comments - Add a new comment to a post
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
    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Comment text cannot be empty" }, { status: 400 });
    }

    const feedItem = await db.feedItem.findUnique({
      where: { id: feedItemId },
      select: { id: true, institutionId: true },
    });

    if (!feedItem) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const newComment = await db.postComment.create({
      data: {
        feedItemId,
        userId: user.id,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            batchYear: true,
            currentRole: true,
            currentCompany: true,
            verificationStatus: true,
          },
        },
      },
    });

    const totalComments = await db.postComment.count({
      where: { feedItemId },
    });

    // Broadcast new comment via Supabase Realtime
    await broadcastFeedEvent(feedItem.institutionId, "new-comment", {
      feedItemId,
      comment: newComment,
      totalComments,
    });

    return NextResponse.json({
      success: true,
      comment: newComment,
      totalComments,
    });
  } catch (error) {
    console.error("Comments POST error:", error);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
