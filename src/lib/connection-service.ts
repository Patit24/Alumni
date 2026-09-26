import { db } from "@/lib/db";
import { sendRealtimeBroadcast } from "@/lib/realtime-broadcast";

export type ConnectionStatus =
  | "CONNECTED"
  | "PENDING_OUTGOING"
  | "PENDING_INCOMING"
  | "NOT_CONNECTED"
  | "SELF"
  | "BLOCKED";

export type ConnectionDegree = "1st" | "2nd" | "3rd";

export interface LinkedInConnectionRelationship {
  status: ConnectionStatus;
  degree: ConnectionDegree;
  isConnection: boolean;
  connectionId?: string;
  initiatedBy?: string;
  canConnect: boolean;
  canAccept: boolean;
  canIgnore: boolean;
  canWithdraw: boolean;
  canRemove: boolean;
  canMessage: boolean;
  mutualCount: number;
  createdAt?: string;
  acceptedAt?: string;
}

// Backward-compatibility alias
export type CanonicalRelationship = LinkedInConnectionRelationship;

export interface ConnectionProfile {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  batchYear: number;
  currentRole: string | null;
  currentCompany: string | null;
  city: string | null;
  verificationStatus: string;
  institution: { id: string; name: string; city: string | null };
  department: { id: string; name: string } | null;
  connectedAt?: string;
  mutualCount?: number;
}

export type FriendProfile = ConnectionProfile;

export interface InvitationItem {
  id: string;
  createdAt: string;
  user: ConnectionProfile;
  mutualCount: number;
}

/**
 * Returns deterministic lexicographically ordered user pair.
 * userAId is guaranteed to be strictly less than userBId.
 */
export function canonicalUserPair(userId1: string, userId2: string): { userAId: string; userBId: string } {
  if (userId1 === userId2) {
    throw new Error("Cannot form a canonical pair with the same user ID");
  }
  return userId1 < userId2
    ? { userAId: userId1, userBId: userId2 }
    : { userAId: userId2, userBId: userId1 };
}

/**
 * Get all 1st-degree connected user IDs for a given user.
 */
export async function getConnectedUserIds(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();

  const [connections, blocks] = await Promise.all([
    db.connectionRequest.findMany({
      where: {
        status: { in: ["ACCEPTED", "CONNECTED"] },
        OR: [
          { userAId: userId },
          { userBId: userId },
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      select: { userAId: true, userBId: true, senderId: true, receiverId: true },
    }),
    db.userBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const blockedSet = new Set<string>();
  blocks.forEach((b) => {
    if (b.blockerId === userId) blockedSet.add(b.blockedId);
    if (b.blockedId === userId) blockedSet.add(b.blockerId);
  });

  const connectedSet = new Set<string>();
  connections.forEach((c) => {
    const otherId =
      c.userAId === userId ? c.userBId :
      c.userBId === userId ? c.userAId :
      c.senderId === userId ? c.receiverId :
      c.receiverId === userId ? c.senderId : null;

    if (otherId && otherId !== userId && !blockedSet.has(otherId)) {
      connectedSet.add(otherId);
    }
  });

  return connectedSet;
}

/**
 * Get full relationship between two users in LinkedIn format.
 */
export async function getConnectionRelationship(
  currentUserId: string,
  targetUserId: string
): Promise<LinkedInConnectionRelationship> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return {
      status: currentUserId === targetUserId ? "SELF" : "NOT_CONNECTED",
      degree: "3rd",
      isConnection: false,
      canConnect: false,
      canAccept: false,
      canIgnore: false,
      canWithdraw: false,
      canRemove: false,
      canMessage: false,
      mutualCount: 0,
    };
  }

  // 1. Check if blocked
  const isBlocked = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: currentUserId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: currentUserId },
      ],
    },
  });

  if (isBlocked) {
    return {
      status: "BLOCKED",
      degree: "3rd",
      isConnection: false,
      canConnect: false,
      canAccept: false,
      canIgnore: false,
      canWithdraw: false,
      canRemove: false,
      canMessage: false,
      mutualCount: 0,
    };
  }

  const { userAId, userBId } = canonicalUserPair(currentUserId, targetUserId);

  // 2. Fetch connection record (prioritize active ACCEPTED)
  let connection = await db.connectionRequest.findFirst({
    where: {
      status: { in: ["ACCEPTED", "CONNECTED"] },
      OR: [
        { userAId, userBId },
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!connection) {
    connection = await db.connectionRequest.findFirst({
      where: {
        OR: [
          { userAId, userBId },
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  // 3. Compute mutual connections count
  const [myFriends, targetFriends] = await Promise.all([
    getConnectedUserIds(currentUserId),
    getConnectedUserIds(targetUserId),
  ]);

  let mutualCount = 0;
  myFriends.forEach((id) => {
    if (targetFriends.has(id)) mutualCount++;
  });

  // If connected (1st Degree)
  if (connection && (connection.status === "ACCEPTED" || connection.status === "CONNECTED")) {
    return {
      status: "CONNECTED",
      degree: "1st",
      isConnection: true,
      connectionId: connection.id,
      initiatedBy: connection.initiatedBy || connection.senderId,
      canConnect: false,
      canAccept: false,
      canIgnore: false,
      canWithdraw: false,
      canRemove: true,
      canMessage: true,
      mutualCount,
      createdAt: connection.createdAt.toISOString(),
      acceptedAt: connection.acceptedAt?.toISOString() || connection.updatedAt.toISOString(),
    };
  }

  // If pending invitation
  if (connection && connection.status === "PENDING") {
    const isOutgoing = (connection.senderId === currentUserId) || (connection.initiatedBy === currentUserId);
    return {
      status: isOutgoing ? "PENDING_OUTGOING" : "PENDING_INCOMING",
      degree: mutualCount > 0 ? "2nd" : "3rd",
      isConnection: false,
      connectionId: connection.id,
      initiatedBy: connection.initiatedBy || connection.senderId,
      canConnect: false,
      canAccept: !isOutgoing,
      canIgnore: !isOutgoing,
      canWithdraw: isOutgoing,
      canRemove: false,
      canMessage: false,
      mutualCount,
      createdAt: connection.createdAt.toISOString(),
    };
  }

  // Not connected
  return {
    status: "NOT_CONNECTED",
    degree: mutualCount > 0 ? "2nd" : "3rd",
    isConnection: false,
    canConnect: true,
    canAccept: false,
    canIgnore: false,
    canWithdraw: false,
    canRemove: false,
    canMessage: false,
    mutualCount,
  };
}

/**
 * Send a LinkedIn-style Connection Invitation.
 * If mutual pending exists, automatically accepts it.
 */
export async function sendConnectionInvitation(
  senderId: string,
  targetUserId: string,
  message?: string
): Promise<LinkedInConnectionRelationship> {
  if (senderId === targetUserId) {
    throw new Error("Cannot connect with yourself");
  }

  const { userAId, userBId } = canonicalUserPair(senderId, targetUserId);

  // Check if blocked
  const isBlocked = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: senderId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: senderId },
      ],
    },
  });
  if (isBlocked) {
    throw new Error("Unable to connect with this user");
  }

  const existing = await db.connectionRequest.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { senderId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: senderId },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  // If already connected
  if (existing && (existing.status === "ACCEPTED" || existing.status === "CONNECTED")) {
    return getConnectionRelationship(senderId, targetUserId);
  }

  // If incoming invitation already pending from targetUser, accept it directly!
  if (existing && existing.status === "PENDING") {
    if (existing.senderId === targetUserId || existing.initiatedBy === targetUserId) {
      return acceptConnectionInvitation(senderId, targetUserId);
    }
    // Already sent
    return getConnectionRelationship(senderId, targetUserId);
  }

  const senderUser = await db.user.findUnique({
    where: { id: senderId },
    select: { id: true, name: true, username: true, avatarUrl: true },
  });

  const now = new Date();
  let connection;
  if (existing) {
    connection = await db.connectionRequest.update({
      where: { id: existing.id },
      data: {
        userAId,
        userBId,
        initiatedBy: senderId,
        senderId,
        receiverId: targetUserId,
        status: "PENDING",
        acceptedAt: null,
        updatedAt: now,
      },
    });
  } else {
    connection = await db.connectionRequest.create({
      data: {
        userAId,
        userBId,
        initiatedBy: senderId,
        senderId,
        receiverId: targetUserId,
        status: "PENDING",
        acceptedAt: null,
      },
    });
  }

  // Create notification
  await db.appNotification.create({
    data: {
      userId: targetUserId,
      actorId: senderId,
      type: "CONNECTION_REQUEST",
      title: "New Connection Invitation",
      body: `${senderUser?.name || "An alumnus"} invited you to connect.`,
      data: JSON.stringify({
        connectionId: connection.id,
        peerId: senderId,
        peerName: senderUser?.name,
        peerUsername: senderUser?.username,
        peerAvatarUrl: senderUser?.avatarUrl,
        message,
      }),
    },
  }).catch(() => {});

  // Realtime signals
  sendRealtimeBroadcast(`p2p-signal:${targetUserId}`, "connection-requested", {
    connectionId: connection.id,
    peerId: senderId,
    peerName: senderUser?.name,
    peerUsername: senderUser?.username,
  }).catch(() => {});

  sendRealtimeBroadcast(`p2p-signal:${senderId}`, "connection-updated", {
    peerId: targetUserId,
    status: "PENDING_OUTGOING",
  }).catch(() => {});

  return getConnectionRelationship(senderId, targetUserId);
}

/**
 * Accept a Connection Invitation.
 * Instantly makes both users 1st-degree connections.
 */
export async function acceptConnectionInvitation(
  userId: string,
  senderId: string
): Promise<LinkedInConnectionRelationship> {
  const { userAId, userBId } = canonicalUserPair(userId, senderId);

  const existing = await db.connectionRequest.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { senderId: userId, receiverId: senderId },
        { senderId: senderId, receiverId: userId },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  const currentUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, avatarUrl: true },
  });

  if (existing) {
    await db.connectionRequest.update({
      where: { id: existing.id },
      data: {
        userAId,
        userBId,
        status: "ACCEPTED",
        acceptedAt: now,
      },
    });
  } else {
    await db.connectionRequest.create({
      data: {
        userAId,
        userBId,
        initiatedBy: senderId,
        senderId,
        receiverId: userId,
        status: "ACCEPTED",
        acceptedAt: now,
      },
    });
  }

  // Create acceptance notification
  await db.appNotification.create({
    data: {
      userId: senderId,
      actorId: userId,
      type: "CONNECTION_ACCEPTED",
      title: "Invitation Accepted",
      body: `${currentUser?.name || "An alumnus"} accepted your connection invitation. You are now 1st degree connections!`,
      data: JSON.stringify({
        peerId: userId,
        peerName: currentUser?.name,
        peerUsername: currentUser?.username,
        peerAvatarUrl: currentUser?.avatarUrl,
      }),
    },
  }).catch(() => {});

  // Mark request notification as read
  await db.appNotification.updateMany({
    where: {
      userId,
      actorId: senderId,
      type: "CONNECTION_REQUEST",
      isRead: false,
    },
    data: { isRead: true },
  }).catch(() => {});

  // Realtime broadcasts
  sendRealtimeBroadcast(`p2p-signal:${senderId}`, "connection-accepted", {
    peerId: userId,
    peerName: currentUser?.name,
    peerUsername: currentUser?.username,
  }).catch(() => {});

  sendRealtimeBroadcast(`p2p-signal:${userId}`, "connection-updated", {
    peerId: senderId,
    status: "CONNECTED",
  }).catch(() => {});

  return getConnectionRelationship(userId, senderId);
}

/**
 * Withdraw an outgoing Connection Invitation.
 * Allows the sender to cancel their invitation before acceptance.
 */
export async function withdrawConnectionInvitation(
  senderId: string,
  targetUserId: string
): Promise<LinkedInConnectionRelationship> {
  const { userAId, userBId } = canonicalUserPair(senderId, targetUserId);

  await db.connectionRequest.deleteMany({
    where: {
      status: "PENDING",
      OR: [
        { userAId, userBId, initiatedBy: senderId },
        { senderId, receiverId: targetUserId },
      ],
    },
  });

  sendRealtimeBroadcast(`p2p-signal:${targetUserId}`, "connection-updated", {
    peerId: senderId,
    status: "NOT_CONNECTED",
  }).catch(() => {});

  sendRealtimeBroadcast(`p2p-signal:${senderId}`, "connection-updated", {
    peerId: targetUserId,
    status: "NOT_CONNECTED",
  }).catch(() => {});

  return getConnectionRelationship(senderId, targetUserId);
}

/**
 * Ignore / Decline an incoming Connection Invitation.
 */
export async function ignoreConnectionInvitation(
  userId: string,
  senderId: string
): Promise<LinkedInConnectionRelationship> {
  const { userAId, userBId } = canonicalUserPair(userId, senderId);

  await db.connectionRequest.updateMany({
    where: {
      status: "PENDING",
      OR: [
        { userAId, userBId, initiatedBy: senderId },
        { senderId, receiverId: userId },
      ],
    },
    data: { status: "REJECTED" },
  });

  // Mark notification read
  await db.appNotification.updateMany({
    where: {
      userId,
      actorId: senderId,
      type: "CONNECTION_REQUEST",
      isRead: false,
    },
    data: { isRead: true },
  }).catch(() => {});

  sendRealtimeBroadcast(`p2p-signal:${userId}`, "connection-updated", {
    peerId: senderId,
    status: "NOT_CONNECTED",
  }).catch(() => {});

  return getConnectionRelationship(userId, senderId);
}

/**
 * Remove a 1st-degree connection.
 * Completely disconnects the two users.
 */
export async function removeConnection(
  userId: string,
  targetUserId: string
): Promise<LinkedInConnectionRelationship> {
  const { userAId, userBId } = canonicalUserPair(userId, targetUserId);

  await db.connectionRequest.deleteMany({
    where: {
      OR: [
        { userAId, userBId },
        { senderId: userId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: userId },
      ],
    },
  });

  sendRealtimeBroadcast(`p2p-signal:${targetUserId}`, "connection-updated", {
    peerId: userId,
    status: "NOT_CONNECTED",
  }).catch(() => {});

  sendRealtimeBroadcast(`p2p-signal:${userId}`, "connection-updated", {
    peerId: targetUserId,
    status: "NOT_CONNECTED",
  }).catch(() => {});

  return {
    status: "NOT_CONNECTED",
    degree: "3rd",
    isConnection: false,
    canConnect: true,
    canAccept: false,
    canIgnore: false,
    canWithdraw: false,
    canRemove: false,
    canMessage: false,
    mutualCount: 0,
  };
}

/**
 * Get all 1st-degree connections with complete profile info.
 */
export async function getMyConnections(
  userId: string,
  searchFilter?: string
): Promise<ConnectionProfile[]> {
  const connectedIds = await getConnectedUserIds(userId);
  if (connectedIds.size === 0) return [];

  const users = await db.user.findMany({
    where: {
      id: { in: Array.from(connectedIds) },
      ...(searchFilter?.trim()
        ? {
            OR: [
              { name: { contains: searchFilter.trim() } },
              { username: { contains: searchFilter.trim() } },
              { currentRole: { contains: searchFilter.trim() } },
              { currentCompany: { contains: searchFilter.trim() } },
              { city: { contains: searchFilter.trim() } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      batchYear: true,
      currentRole: true,
      currentCompany: true,
      city: true,
      verificationStatus: true,
      institution: { select: { id: true, name: true, city: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  // Find acceptedAt timestamps from connection requests
  const records = await db.connectionRequest.findMany({
    where: {
      status: { in: ["ACCEPTED", "CONNECTED"] },
      OR: [
        { userAId: userId },
        { userBId: userId },
        { senderId: userId },
        { receiverId: userId },
      ],
    },
    select: { userAId: true, userBId: true, senderId: true, receiverId: true, acceptedAt: true, updatedAt: true },
  });

  const acceptedDateMap = new Map<string, string>();
  records.forEach((r) => {
    const peerId =
      r.userAId === userId ? r.userBId :
      r.userBId === userId ? r.userAId :
      r.senderId === userId ? r.receiverId :
      r.receiverId === userId ? r.senderId : null;
    if (peerId) {
      const date = r.acceptedAt || r.updatedAt;
      acceptedDateMap.set(peerId, date.toISOString());
    }
  });

  return users.map((u) => ({
    ...u,
    connectedAt: acceptedDateMap.get(u.id),
  }));
}

/**
 * Get pending invitations (received and sent).
 */
export async function getInvitations(userId: string): Promise<{
  received: InvitationItem[];
  sent: InvitationItem[];
}> {
  const [incomingReqs, outgoingReqs, myFriends] = await Promise.all([
    db.connectionRequest.findMany({
      where: {
        status: "PENDING",
        OR: [
          { receiverId: userId },
          { userAId: userId, initiatedBy: { not: userId } },
          { userBId: userId, initiatedBy: { not: userId } },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            batchYear: true,
            currentRole: true,
            currentCompany: true,
            city: true,
            verificationStatus: true,
            institution: { select: { id: true, name: true, city: true } },
            department: { select: { id: true, name: true } },
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            batchYear: true,
            currentRole: true,
            currentCompany: true,
            city: true,
            verificationStatus: true,
            institution: { select: { id: true, name: true, city: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.connectionRequest.findMany({
      where: {
        status: "PENDING",
        OR: [
          { senderId: userId },
          { userAId: userId, initiatedBy: userId },
          { userBId: userId, initiatedBy: userId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            batchYear: true,
            currentRole: true,
            currentCompany: true,
            city: true,
            verificationStatus: true,
            institution: { select: { id: true, name: true, city: true } },
            department: { select: { id: true, name: true } },
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            batchYear: true,
            currentRole: true,
            currentCompany: true,
            city: true,
            verificationStatus: true,
            institution: { select: { id: true, name: true, city: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getConnectedUserIds(userId),
  ]);

  const received = await Promise.all(
    incomingReqs
      .map(async (r) => {
        const otherUser = r.senderId === userId ? r.receiver : r.sender;
        if (!otherUser || otherUser.id === userId) return null;
        const otherFriends = await getConnectedUserIds(otherUser.id);
        let mutualCount = 0;
        myFriends.forEach((id) => {
          if (otherFriends.has(id)) mutualCount++;
        });
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          user: otherUser as ConnectionProfile,
          mutualCount,
        };
      })
  );

  const sent = await Promise.all(
    outgoingReqs
      .map(async (r) => {
        const otherUser = r.senderId === userId ? r.receiver : r.sender;
        if (!otherUser || otherUser.id === userId) return null;
        const otherFriends = await getConnectedUserIds(otherUser.id);
        let mutualCount = 0;
        myFriends.forEach((id) => {
          if (otherFriends.has(id)) mutualCount++;
        });
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          user: otherUser as ConnectionProfile,
          mutualCount,
        };
      })
  );

  return {
    received: (received.filter((x) => Boolean(x)) as InvitationItem[]),
    sent: (sent.filter((x) => Boolean(x)) as InvitationItem[]),
  };
}

/**
 * LinkedIn-Style "People You May Know" Recommendations Engine.
 * Recommends alumni from same institution, department, and batch year,
 * ranked by mutual connections and academic affinity.
 */
export async function getPeopleYouMayKnow(
  userId: string,
  limit: number = 20
): Promise<ConnectionProfile[]> {
  const currentUser = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      institutionId: true,
      departmentId: true,
      batchYear: true,
    },
  });

  if (!currentUser) return [];

  // Exclude self, existing 1st-degree connections, pending invites, and blocked users
  const [connectedIds, pendingReqs, blocks] = await Promise.all([
    getConnectedUserIds(userId),
    db.connectionRequest.findMany({
      where: {
        status: "PENDING",
        OR: [
          { senderId: userId },
          { receiverId: userId },
          { userAId: userId },
          { userBId: userId },
        ],
      },
      select: { senderId: true, receiverId: true, userAId: true, userBId: true },
    }),
    db.userBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const excluded = new Set<string>(connectedIds);
  excluded.add(userId);

  pendingReqs.forEach((r) => {
    if (r.senderId) excluded.add(r.senderId);
    if (r.receiverId) excluded.add(r.receiverId);
    if (r.userAId) excluded.add(r.userAId);
    if (r.userBId) excluded.add(r.userBId);
  });

  blocks.forEach((b) => {
    excluded.add(b.blockerId);
    excluded.add(b.blockedId);
  });

  // Query candidate alumni
  const candidates = await db.user.findMany({
    where: {
      id: { notIn: Array.from(excluded) },
      institutionId: currentUser.institutionId,
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      batchYear: true,
      currentRole: true,
      currentCompany: true,
      city: true,
      verificationStatus: true,
      departmentId: true,
      institution: { select: { id: true, name: true, city: true } },
      department: { select: { id: true, name: true } },
    },
    take: 60,
  });

  // Calculate mutual connections for each candidate
  const candidatesWithScore = await Promise.all(
    candidates.map(async (candidate) => {
      const candidateFriends = await getConnectedUserIds(candidate.id);
      let mutualCount = 0;
      connectedIds.forEach((id) => {
        if (candidateFriends.has(id)) mutualCount++;
      });

      // Score: mutual connections (x10) + same department (x5) + same batch (x3)
      let score = mutualCount * 10;
      if (candidate.departmentId && candidate.departmentId === currentUser.departmentId) {
        score += 5;
      }
      if (candidate.batchYear && candidate.batchYear === currentUser.batchYear) {
        score += 3;
      }

      return {
        ...candidate,
        mutualCount,
        score,
      };
    })
  );

  // Sort descending by relevance score
  candidatesWithScore.sort((a, b) => b.score - a.score);

  return candidatesWithScore.slice(0, limit).map(({ score, departmentId, ...profile }) => profile);
}

// =========================================================================
// BACKWARD-COMPATIBILITY EXPORTS FOR LEGACY CALLERS
// =========================================================================

export async function getRelationship(currentUserId: string, targetUserId: string): Promise<any> {
  const rel = await getConnectionRelationship(currentUserId, targetUserId);
  return {
    ...rel,
    isFriend: rel.isConnection,
  };
}

export async function sendConnectionRequest(senderId: string, targetUserId: string): Promise<any> {
  const rel = await sendConnectionInvitation(senderId, targetUserId);
  return {
    ...rel,
    isFriend: rel.isConnection,
  };
}

export async function acceptConnectionRequest(userId: string, senderId: string): Promise<any> {
  const rel = await acceptConnectionInvitation(userId, senderId);
  return {
    ...rel,
    isFriend: rel.isConnection,
  };
}

export async function rejectConnectionRequest(userId: string, senderId: string): Promise<any> {
  const rel = await ignoreConnectionInvitation(userId, senderId);
  return {
    ...rel,
    isFriend: rel.isConnection,
  };
}

export async function cancelConnectionRequest(senderId: string, targetUserId: string): Promise<any> {
  const rel = await withdrawConnectionInvitation(senderId, targetUserId);
  return {
    ...rel,
    isFriend: rel.isConnection,
  };
}

export async function unfriendUser(currentUserId: string, targetUserId: string): Promise<any> {
  const rel = await removeConnection(currentUserId, targetUserId);
  return {
    ...rel,
    isFriend: false,
  };
}

export async function getConnectedFriends(userId: string): Promise<ConnectionProfile[]> {
  return getMyConnections(userId);
}
