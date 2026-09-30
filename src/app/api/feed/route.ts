import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { broadcastFeedEvent } from "@/lib/supabase-broadcast";
import { getConnectedFriends } from "@/lib/connection-service";

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

    // 1. Resolve user's accepted friends and community connections
    const [connectedFriends, myCommunities] = await Promise.all([
      getConnectedFriends(user.id),
      db.communityMember.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        select: { communityId: true },
      }),
    ]);

    const friendIdsSet = new Set<string>();
    friendIdsSet.add(user.id); // User can always see their own posts
    connectedFriends.forEach((f) => friendIdsSet.add(f.id));



    if (myCommunities.length > 0) {
      const communityIds = myCommunities.map((c) => c.communityId);
      const coMembers = await db.communityMember.findMany({
        where: {
          communityId: { in: communityIds },
          status: "ACTIVE",
        },
        select: { userId: true },
        take: 500,
      });
      coMembers.forEach((cm) => {
        if (cm.userId && cm.userId !== user.id) friendIdsSet.add(cm.userId);
      });
    }

    const friendIds = Array.from(friendIdsSet);
    const viralFriendIds = friendIds.filter((id) => id !== user.id);

    // 2. Build where filter according to visibility rules:
    // - Regular posts / photo updates: show to all connected friends/contacts AND peers from mutual school/college
    // - Jobs & Mentorship: show to mutual institution OR connected peers
    // - SAVED: show posts bookmarked by the user
    const where: Prisma.FeedItemWhereInput = {};

    if (filter === "SAVED") {
      where.saves = {
        some: { userId: user.id },
      };
    } else if (filter === "JOBS") {
      where.type = "JOB_POSTED";
      where.OR = [
        ...(user.institutionId ? [{ institutionId: user.institutionId }] : []),
        { actorId: { in: friendIds } },
        ...(viralFriendIds.length > 0 ? [{ likes: { some: { userId: { in: viralFriendIds } } } }] : []),
        ...(viralFriendIds.length > 0 ? [{ comments: { some: { userId: { in: viralFriendIds } } } }] : []),
      ];
    } else if (filter === "MENTORSHIP") {
      where.type = "MENTORSHIP_AVAILABLE";
      where.OR = [
        ...(user.institutionId ? [{ institutionId: user.institutionId }] : []),
        { actorId: { in: friendIds } },
        ...(viralFriendIds.length > 0 ? [{ likes: { some: { userId: { in: viralFriendIds } } } }] : []),
        ...(viralFriendIds.length > 0 ? [{ comments: { some: { userId: { in: viralFriendIds } } } }] : []),
      ];
    } else if (filter === "BATCH") {
      where.actor = {
        batchYear: user.batchYear,
        OR: [
          ...(user.institutionId ? [{ institutionId: user.institutionId }] : []),
          { id: { in: friendIds } },
        ],
      };
    } else {
      // "ALL" (Default feed with Social Graph Viral algorithm):
      where.OR = [
        // a) Any post / photo update from any connected peer, friend, or user themselves
        { actorId: { in: friendIds } },
        // b) Posts from alumni of the mutual school or college
        ...(user.institutionId ? [{ institutionId: user.institutionId }] : []),
        // c) Social Graph Viral: Posts liked by any friend in user's network
        ...(viralFriendIds.length > 0 ? [{ likes: { some: { userId: { in: viralFriendIds } } } }] : []),
        // d) Social Graph Viral: Posts commented on by any friend in user's network
        ...(viralFriendIds.length > 0 ? [{ comments: { some: { userId: { in: viralFriendIds } } } }] : []),
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
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                currentRole: true,
                currentCompany: true,
              },
            },
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

      // Social Graph Viral Context:
      // If a friend of the current user liked or commented on this post, surface attribution
      let viralContext: {
        type: "LIKE" | "COMMENT";
        userId: string;
        userName: string;
        userRole?: string | null;
        userAvatar?: string | null;
        otherCount?: number;
      } | null = null;

      if (item.actorId !== user.id) {
        const friendComments = item.comments.filter(
          (c) => viralFriendIds.includes(c.userId) && c.userId !== item.actorId
        );
        const friendLikes = item.likes.filter(
          (l) => viralFriendIds.includes(l.userId) && l.userId !== item.actorId
        );

        if (friendComments.length > 0 && friendComments[0].user) {
          viralContext = {
            type: "COMMENT",
            userId: friendComments[0].user.id,
            userName: friendComments[0].user.name,
            userRole: friendComments[0].user.currentRole || null,
            userAvatar: friendComments[0].user.avatarUrl || null,
            otherCount: Math.max(0, friendComments.length - 1),
          };
        } else if (friendLikes.length > 0 && friendLikes[0].user) {
          viralContext = {
            type: "LIKE",
            userId: friendLikes[0].user.id,
            userName: friendLikes[0].user.name,
            userRole: friendLikes[0].user.currentRole || null,
            userAvatar: friendLikes[0].user.avatarUrl || null,
            otherCount: Math.max(0, friendLikes.length - 1),
          };
        }
      }

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
        viralContext,
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
