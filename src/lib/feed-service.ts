import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getConnectedFriends } from "@/lib/connection-service";

export interface FeedActor {
  id: string;
  name: string;
  avatarUrl: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  batchYear: number;
  verificationStatus: string;
  department: { name: string } | null;
  institutionId: string;
  institution: { name: string; type: string };
}

export interface FeedViralContext {
  type: "LIKE" | "COMMENT";
  userId: string;
  userName: string;
  userRole?: string | null;
  userAvatar?: string | null;
  otherCount?: number;
}

export interface FeedItemData {
  id: string;
  type: string;
  createdAt: string;
  actor: FeedActor;
  hasLiked: boolean;
  hasSaved: boolean;
  likesCount: number;
  savesCount: number;
  commentsCount: number;
  sharesCount: number;
  isFriend: boolean;
  isMutualInstitution: boolean;
  viralContext?: FeedViralContext | null;
  comments: any[];
  metadata: Record<string, any>;
}

export async function getFeedItemsForUser(
  user: {
    id: string;
    batchYear: number;
    institutionId?: string | null;
  },
  filter = "ALL"
): Promise<FeedItemData[]> {
  try {
    // 1. Resolve user's accepted friends and community connections
    const [connectedFriends, myCommunities] = await Promise.all([
      getConnectedFriends(user.id),
      db.communityMember.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        select: { communityId: true },
      }),
    ]);

    const friendIdsSet = new Set<string>();
    friendIdsSet.add(user.id);
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

    // 2. Build where filter according to visibility rules
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
        { actorId: { in: friendIds } },
        ...(user.institutionId ? [{ institutionId: user.institutionId }] : []),
        ...(viralFriendIds.length > 0 ? [{ likes: { some: { userId: { in: viralFriendIds } } } }] : []),
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
                currentRole: true,
                currentCompany: true,
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
      take: 40,
    });

    return items.map((item) => {
      let meta: Record<string, any> = {};
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

      let viralContext: FeedViralContext | null = null;
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
        createdAt: item.createdAt.toISOString(),
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
        comments: item.comments.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
        metadata: {
          ...meta,
          likes: likesCount,
          savesCount,
          commentsCount,
          sharesCount,
        },
      };
    });
  } catch (error) {
    console.error("[getFeedItemsForUser] Error fetching feed items:", error);
    return [];
  }
}
