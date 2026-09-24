import { db } from "@/lib/db";
import { sendRealtimeBroadcast } from "@/lib/realtime-broadcast";

export type RelationshipStatus =
  | "NONE"
  | "PENDING_OUTGOING"
  | "PENDING_INCOMING"
  | "CONNECTED"
  | "REJECTED"
  | "CANCELLED"
  | "BLOCKED";

export interface CanonicalRelationship {
  status: RelationshipStatus;
  isFriend: boolean;
  connectionId?: string;
  initiatedBy?: string;
  canConnect: boolean;
  canAccept: boolean;
  canReject: boolean;
  canCancel: boolean;
  canMessage: boolean;
  createdAt?: string;
  acceptedAt?: string;
}

export interface FriendProfile {
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
 * Authoritative relationship resolver for any two users.
 * Uses a single canonical indexed query on [userAId, userBId].
 */
export async function getRelationship(
  currentUserId: string,
  targetUserId: string
): Promise<CanonicalRelationship> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return {
      status: "NONE",
      isFriend: false,
      canConnect: false,
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: false,
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
      isFriend: false,
      canConnect: false,
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: false,
    };
  }

  const { userAId, userBId } = canonicalUserPair(currentUserId, targetUserId);

  // 2. Fetch canonical connection record
  const connection = await db.connectionRequest.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId },
      ],
    },
  });

  if (!connection) {
    return {
      status: "NONE",
      isFriend: false,
      canConnect: true,
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: false,
    };
  }

  const createdAt = connection.createdAt.toISOString();
  const acceptedAt = connection.acceptedAt?.toISOString();
  const initiatedBy = connection.initiatedBy || connection.senderId;

  if (connection.status === "ACCEPTED" || connection.status === "CONNECTED") {
    return {
      status: "CONNECTED",
      isFriend: true,
      connectionId: connection.id,
      initiatedBy,
      canConnect: false,
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: true,
      createdAt,
      acceptedAt,
    };
  }

  if (connection.status === "PENDING") {
    const isOutgoing = initiatedBy === currentUserId;
    return {
      status: isOutgoing ? "PENDING_OUTGOING" : "PENDING_INCOMING",
      isFriend: false,
      connectionId: connection.id,
      initiatedBy,
      canConnect: false,
      canAccept: !isOutgoing,
      canReject: !isOutgoing,
      canCancel: isOutgoing,
      canMessage: false,
      createdAt,
    };
  }

  if (connection.status === "REJECTED") {
    return {
      status: "REJECTED",
      isFriend: false,
      connectionId: connection.id,
      initiatedBy,
      canConnect: true, // Allow reconnect attempt
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: false,
      createdAt,
    };
  }

  if (connection.status === "CANCELLED") {
    return {
      status: "NONE",
      isFriend: false,
      connectionId: connection.id,
      canConnect: true,
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: false,
    };
  }

  return {
    status: "NONE",
    isFriend: false,
    canConnect: true,
    canAccept: false,
    canReject: false,
    canCancel: false,
    canMessage: false,
  };
}

/**
 * Fast batch relationship resolver for directory, friends lists, and search queries.
 */
export async function getRelationshipsBatch(
  currentUserId: string,
  targetUserIds: string[]
): Promise<Map<string, CanonicalRelationship>> {
  const result = new Map<string, CanonicalRelationship>();
  if (!currentUserId || targetUserIds.length === 0) return result;

  const validTargetIds = targetUserIds.filter((id) => id && id !== currentUserId);
  if (validTargetIds.length === 0) return result;

  // Initialize all with default NONE
  validTargetIds.forEach((tid) => {
    result.set(tid, {
      status: "NONE",
      isFriend: false,
      canConnect: true,
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: false,
    });
  });

  // Query all connections involving currentUserId and any targetId
  const [connections, blocks] = await Promise.all([
    db.connectionRequest.findMany({
      where: {
        OR: [
          { userAId: currentUserId, userBId: { in: validTargetIds } },
          { userBId: currentUserId, userAId: { in: validTargetIds } },
          { senderId: currentUserId, receiverId: { in: validTargetIds } },
          { receiverId: currentUserId, senderId: { in: validTargetIds } },
        ],
      },
    }),
    db.userBlock.findMany({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: { in: validTargetIds } },
          { blockerId: { in: validTargetIds }, blockedId: currentUserId },
        ],
      },
    }),
  ]);

  // Mark blocks
  blocks.forEach((b) => {
    const targetId = b.blockerId === currentUserId ? b.blockedId : b.blockerId;
    result.set(targetId, {
      status: "BLOCKED",
      isFriend: false,
      canConnect: false,
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: false,
    });
  });

  // Map connections
  connections.forEach((conn) => {
    const targetId =
      conn.senderId === currentUserId ? conn.receiverId : conn.senderId;

    if (result.get(targetId)?.status === "BLOCKED") return;

    const initiatedBy = conn.initiatedBy || conn.senderId;
    const createdAt = conn.createdAt.toISOString();
    const acceptedAt = conn.acceptedAt?.toISOString();

    if (conn.status === "ACCEPTED" || conn.status === "CONNECTED") {
      result.set(targetId, {
        status: "CONNECTED",
        isFriend: true,
        connectionId: conn.id,
        initiatedBy,
        canConnect: false,
        canAccept: false,
        canReject: false,
        canCancel: false,
        canMessage: true,
        createdAt,
        acceptedAt,
      });
    } else if (conn.status === "PENDING") {
      const isOutgoing = initiatedBy === currentUserId;
      result.set(targetId, {
        status: isOutgoing ? "PENDING_OUTGOING" : "PENDING_INCOMING",
        isFriend: false,
        connectionId: conn.id,
        initiatedBy,
        canConnect: false,
        canAccept: !isOutgoing,
        canReject: !isOutgoing,
        canCancel: isOutgoing,
        canMessage: false,
        createdAt,
      });
    } else if (conn.status === "REJECTED") {
      result.set(targetId, {
        status: "REJECTED",
        isFriend: false,
        connectionId: conn.id,
        initiatedBy,
        canConnect: true,
        canAccept: false,
        canReject: false,
        canCancel: false,
        canMessage: false,
        createdAt,
      });
    }
  });

  return result;
}

/**
 * Send a connection request.
 * If target user has already sent a pending request, immediately auto-accepts!
 */
export async function sendConnectionRequest(
  senderId: string,
  targetUserId: string
): Promise<CanonicalRelationship> {
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

  // Look for existing connection
  const existing = await db.connectionRequest.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { senderId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: senderId },
      ],
    },
  });

  // 1. If already connected, return immediately
  if (existing && (existing.status === "ACCEPTED" || existing.status === "CONNECTED")) {
    return {
      status: "CONNECTED",
      isFriend: true,
      connectionId: existing.id,
      canConnect: false,
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: true,
    };
  }

  // 2. If targetUser already sent sender a PENDING request -> Reciprocal auto-accept!
  const targetSentPending =
    existing &&
    existing.status === "PENDING" &&
    (existing.initiatedBy === targetUserId || existing.senderId === targetUserId);

  if (targetSentPending) {
    return await acceptConnectionRequest(senderId, targetUserId);
  }

  // 3. Sender user details for notification
  const senderUser = await db.user.findUnique({
    where: { id: senderId },
    select: { id: true, name: true, username: true, avatarUrl: true },
  });

  // 4. Create or re-open request
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
        updatedAt: new Date(),
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
      },
    });
  }

  // 5. In-App notification for target user
  await db.appNotification.create({
    data: {
      userId: targetUserId,
      actorId: senderId,
      type: "CONNECTION_REQUEST",
      title: "New Connection Request",
      body: `${senderUser?.name || "An alumnus"} sent you a connection request.`,
      data: JSON.stringify({
        connectionId: connection.id,
        peerId: senderId,
        peerName: senderUser?.name,
        peerUsername: senderUser?.username,
        peerAvatarUrl: senderUser?.avatarUrl,
      }),
    },
  }).catch(() => {});

  // 6. Realtime broadcast to target user
  sendRealtimeBroadcast(`p2p-signal:${targetUserId}`, "connection-request-received", {
    connectionId: connection.id,
    peerId: senderId,
    peerName: senderUser?.name,
    peerUsername: senderUser?.username,
    createdAt: connection.createdAt.toISOString(),
  }).catch(() => {});

  return {
    status: "PENDING_OUTGOING",
    isFriend: false,
    connectionId: connection.id,
    initiatedBy: senderId,
    canConnect: false,
    canAccept: false,
    canReject: false,
    canCancel: true,
    canMessage: false,
    createdAt: connection.createdAt.toISOString(),
  };
}

/**
 * Accept connection request atomically.
 * Updates ConnectionRequest, creates bidirectional ContactTrust, notifies sender,
 * and broadcasts realtime updates.
 */
export async function acceptConnectionRequest(
  currentUserId: string,
  targetUserId: string
): Promise<CanonicalRelationship> {
  const { userAId, userBId } = canonicalUserPair(currentUserId, targetUserId);

  const existing = await db.connectionRequest.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId },
      ],
    },
  });

  const now = new Date();

  // Current user info for notification
  const currentUser = await db.user.findUnique({
    where: { id: currentUserId },
    select: { id: true, name: true, username: true, avatarUrl: true },
  });

  if (!existing) {
    // Direct connect (e.g. mutual QR scan / instant trust)
    const newConn = await db.$transaction([
      db.connectionRequest.create({
        data: {
          userAId,
          userBId,
          initiatedBy: targetUserId,
          senderId: targetUserId,
          receiverId: currentUserId,
          status: "ACCEPTED",
          acceptedAt: now,
        },
      }),
      db.contactTrust.upsert({
        where: { userId_contactId: { userId: currentUserId, contactId: targetUserId } },
        update: { trustLevel: "CONNECTED" },
        create: { userId: currentUserId, contactId: targetUserId, trustLevel: "CONNECTED" },
      }),
      db.contactTrust.upsert({
        where: { userId_contactId: { userId: targetUserId, contactId: currentUserId } },
        update: { trustLevel: "CONNECTED" },
        create: { userId: targetUserId, contactId: currentUserId, trustLevel: "CONNECTED" },
      }),
    ]);

    // Realtime notification
    sendRealtimeBroadcast(`p2p-signal:${targetUserId}`, "connection-accepted", {
      peerId: currentUserId,
      peerName: currentUser?.name,
      peerUsername: currentUser?.username,
    }).catch(() => {});

    return {
      status: "CONNECTED",
      isFriend: true,
      connectionId: newConn[0].id,
      canConnect: false,
      canAccept: false,
      canReject: false,
      canCancel: false,
      canMessage: true,
      acceptedAt: now.toISOString(),
    };
  }

  // Atomic update
  const [updatedConn] = await db.$transaction([
    db.connectionRequest.update({
      where: { id: existing.id },
      data: {
        userAId,
        userBId,
        status: "ACCEPTED",
        acceptedAt: now,
      },
    }),
    db.contactTrust.upsert({
      where: { userId_contactId: { userId: currentUserId, contactId: targetUserId } },
      update: { trustLevel: "CONNECTED" },
      create: { userId: currentUserId, contactId: targetUserId, trustLevel: "CONNECTED" },
    }),
    db.contactTrust.upsert({
      where: { userId_contactId: { userId: targetUserId, contactId: currentUserId } },
      update: { trustLevel: "CONNECTED" },
      create: { userId: targetUserId, contactId: currentUserId, trustLevel: "CONNECTED" },
    }),
    // Create accept notification for target user
    db.appNotification.create({
      data: {
        userId: targetUserId,
        actorId: currentUserId,
        type: "CONNECTION_ACCEPTED",
        title: "Connection Accepted",
        body: `${currentUser?.name || "An alumnus"} accepted your connection request. You are now connected!`,
        data: JSON.stringify({
          peerId: currentUserId,
          peerName: currentUser?.name,
          peerUsername: currentUser?.username,
          peerAvatarUrl: currentUser?.avatarUrl,
        }),
      },
    }),
    // Mark pending request notification as read
    db.appNotification.updateMany({
      where: {
        userId: currentUserId,
        actorId: targetUserId,
        type: "CONNECTION_REQUEST",
        isRead: false,
      },
      data: { isRead: true },
    }),
  ]);

  // Realtime broadcast to original requester
  sendRealtimeBroadcast(`p2p-signal:${targetUserId}`, "connection-accepted", {
    peerId: currentUserId,
    peerName: currentUser?.name,
    peerUsername: currentUser?.username,
  }).catch(() => {});

  sendRealtimeBroadcast(`p2p-signal:${currentUserId}`, "connection-updated", {
    peerId: targetUserId,
    status: "CONNECTED",
  }).catch(() => {});

  return {
    status: "CONNECTED",
    isFriend: true,
    connectionId: updatedConn.id,
    canConnect: false,
    canAccept: false,
    canReject: false,
    canCancel: false,
    canMessage: true,
    acceptedAt: now.toISOString(),
  };
}

/**
 * Decline / Reject a connection request.
 */
export async function rejectConnectionRequest(
  currentUserId: string,
  targetUserId: string
): Promise<CanonicalRelationship> {
  const { userAId, userBId } = canonicalUserPair(currentUserId, targetUserId);

  await db.connectionRequest.updateMany({
    where: {
      OR: [
        { userAId, userBId, status: "PENDING" },
        { senderId: targetUserId, receiverId: currentUserId, status: "PENDING" },
      ],
    },
    data: { status: "REJECTED" },
  });

  // Mark notification read
  await db.appNotification.updateMany({
    where: {
      userId: currentUserId,
      actorId: targetUserId,
      type: "CONNECTION_REQUEST",
      isRead: false,
    },
    data: { isRead: true },
  }).catch(() => {});

  return {
    status: "REJECTED",
    isFriend: false,
    canConnect: true,
    canAccept: false,
    canReject: false,
    canCancel: false,
    canMessage: false,
  };
}

/**
 * Cancel an outgoing connection request.
 */
export async function cancelConnectionRequest(
  currentUserId: string,
  targetUserId: string
): Promise<CanonicalRelationship> {
  const { userAId, userBId } = canonicalUserPair(currentUserId, targetUserId);

  await db.connectionRequest.updateMany({
    where: {
      OR: [
        { userAId, userBId, status: "PENDING" },
        { senderId: currentUserId, receiverId: targetUserId, status: "PENDING" },
      ],
    },
    data: { status: "CANCELLED" },
  });

  return {
    status: "NONE",
    isFriend: false,
    canConnect: true,
    canAccept: false,
    canReject: false,
    canCancel: false,
    canMessage: false,
  };
}

/**
 * Get all connected friends with complete profiles.
 */
export async function getConnectedFriends(userId: string): Promise<FriendProfile[]> {
  const connections = await db.connectionRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { userAId: userId },
        { userBId: userId },
        { senderId: userId },
        { receiverId: userId },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  const friendIds = new Set<string>();
  connections.forEach((c) => {
    const friendId = c.senderId === userId ? c.receiverId : c.senderId;
    if (friendId && friendId !== userId) friendIds.add(friendId);
    if (c.userAId && c.userAId !== userId) friendIds.add(c.userAId);
    if (c.userBId && c.userBId !== userId) friendIds.add(c.userBId);
  });

  if (friendIds.size === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: Array.from(friendIds) } },
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

  return users;
}
