import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { broadcastFeedEvent } from "@/lib/supabase-broadcast";

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

    // 1. Resolve user's accepted friends / connections
    const [acceptedRequests, connectedTrusts] = await Promise.all([
      db.connectionRequest.findMany({
        where: {
          OR: [
            { senderId: user.id, status: "ACCEPTED" },
            { receiverId: user.id, status: "ACCEPTED" },
          ],
        },
        select: { senderId: true, receiverId: true },
      }),
      db.contactTrust.findMany({
        where: {
          userId: user.id,
          trustLevel: { in: ["CONNECTED", "TRUSTED"] },
        },
        select: { contactId: true },
      }),
    ]);

    const friendIdsSet = new Set<string>();
    friendIdsSet.add(user.id); // User can always see their own posts
    acceptedRequests.forEach((r) => {
      if (r.senderId && r.senderId !== user.id) friendIdsSet.add(r.senderId);
      if (r.receiverId && r.receiverId !== user.id) friendIdsSet.add(r.receiverId);
    });
    connectedTrusts.forEach((t) => {
      if (t.contactId && t.contactId !== user.id) friendIdsSet.add(t.contactId);
    });
    const friendIds = Array.from(friendIdsSet);

    // 2. Build where filter according to visibility rules:
    // - Regular posts / alumni updates: only friends' updates show
    // - Job update or mentorship posts: show to mutual school and college users OR friends
    // - SAVED: show posts bookmarked by the user
    const where: Prisma.FeedItemWhereInput = {};

    if (filter === "SAVED") {
      where.saves = {
        some: { userId: user.id },
      };
    } else if (filter === "JOBS") {
      where.type = "JOB_POSTED";
      where.OR = [
        { institutionId: user.institutionId },
        { actorId: { in: friendIds } },
      ];
    } else if (filter === "MENTORSHIP") {
      where.type = "MENTORSHIP_AVAILABLE";
      where.OR = [
        { institutionId: user.institutionId },
        { actorId: { in: friendIds } },
      ];
    } else if (filter === "BATCH") {
      where.actor = {
        batchYear: user.batchYear,
        OR: [
          { institutionId: user.institutionId },
          { id: { in: friendIds } },
        ],
      };
    } else {
      // "ALL" (Default feed):
      where.OR = [
        // a) Any post by a friend or user themselves
        { actorId: { in: friendIds } },
        // b) Job updates from mutual school/college
        {
          type: "JOB_POSTED",
          institutionId: user.institutionId,
        },
        // c) Mentorship updates from mutual school/college
        {
          type: "MENTORSHIP_AVAILABLE",
          institutionId: user.institutionId,
        },
      ];
    }

    const items = await db.feedItem.findMany({
      where,
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
            department: { select: { name: true } },
            institutionId: true,
            institution: { select: { name: true, type: true } },
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        saves: {
          select: {
            userId: true,
          },
        },
        comments: {
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
        },
        shares: {
          select: {
            id: true,
            platform: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const parsedItems = items.map((item) => {
      let meta: Record<string, unknown> = {};
      try {
        if (item.metadata) meta = JSON.parse(item.metadata);
      } catch {
        meta = { text: item.metadata };
      }

      const hasLiked = item.likes.some((l) => l.userId === user.id);
      const hasSaved = item.saves.some((s) => s.userId === user.id);
      const likesCount = item.likes.length;
      const savesCount = item.saves.length;
      const commentsCount = item.comments.length;
      const sharesCount = item.shares.length;

      const isFriend = friendIdsSet.has(item.actorId) && item.actorId !== user.id;
      const isMutualInstitution = Boolean(
        user.institutionId && item.institutionId === user.institutionId
      );

      return {
        id: item.id,
        type: item.type,
        createdAt: item.createdAt,
        actor: item.actor,
        hasLiked,
        hasSaved,
        likesCount,
        savesCount,
        commentsCount,
        sharesCount,
        isFriend,
        isMutualInstitution,
        comments: item.comments,
        metadata: {
          ...meta,
          likes: likesCount,
          savesCount,
          commentsCount,
          sharesCount,
        },
      };
    });

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
            department: { select: { name: true } },
          },
        },
      },
    });

    let meta = {};
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
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      comments: [],
      metadata: meta,
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
