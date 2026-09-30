import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastFeedEvent } from "@/lib/supabase-broadcast";
import { getFeedItemsForUser } from "@/lib/feed-service";

export const dynamic = "force-dynamic";

// GET /api/feed - Fetch LinkedIn-style posts with live like, comment, share, and save counts
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "ALL"; // "ALL", "SAVED", "JOBS", "MENTORSHIP", "BATCH"

    const parsedItems = await getFeedItemsForUser(user, filter);

    return NextResponse.json({
      currentUser: {
        id: user.id,
        name: user.name,
        verificationStatus: user.verificationStatus,
        batchYear: user.batchYear,
        institutionName: user.institution.name,
        institutionId: user.institutionId,
        institutionType: user.institution.type,
      },
      feed: parsedItems,
    });
  } catch (error) {
    console.error("Feed GET error:", error);
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}

// POST /api/feed - Share an update / post on the feed
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { text, imageUrl, type = "POST" } = body;

    if ((!text || !text.trim()) && !imageUrl) {
      return NextResponse.json({ error: "Post text or photo is required" }, { status: 400 });
    }

    const feedItem = await db.feedItem.create({
      data: {
        institutionId: user.institutionId,
        actorId: user.id,
        type,
        metadata: JSON.stringify({
          text: (text || "").trim(),
          imageUrl: imageUrl || null,
          badge: type === "POST" ? "Alumni Update" : type,
        }),
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            currentRole: true,
            currentCompany: true,
            batchYear: true,
            verificationStatus: true,
            institutionId: true,
            institution: { select: { name: true, type: true } },
            department: { select: { name: true } },
          },
        },
      },
    });

    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(feedItem.metadata || "{}");
    } catch {
      meta = { text: feedItem.metadata };
    }

    const responsePayload = {
      id: feedItem.id,
      type: feedItem.type,
      createdAt: feedItem.createdAt,
      actor: (feedItem as any).actor,
      hasLiked: false,
      hasSaved: false,
      likesCount: 0,
      savesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      isFriend: true,
      isMutualInstitution: true,
      comments: [],
      metadata: {
        ...meta,
        likes: 0,
        savesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
      },
    };

    // Broadcast new post via Supabase Realtime
    await broadcastFeedEvent(user.institutionId, "new-post", responsePayload);

    return NextResponse.json({
      success: true,
      feedItem: responsePayload,
    });
  } catch (error) {
    console.error("Feed POST error:", error);
    return NextResponse.json({ error: "Failed to publish post" }, { status: 500 });
  }
}
