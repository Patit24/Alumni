import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getRelationship,
  getConnectedFriends,
} from "@/lib/connection-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("targetUserId");

    // 1. Incoming pending requests to me
    const incomingRequests = await db.connectionRequest.findMany({
      where: {
        OR: [
          { receiverId: user.id, status: "PENDING" },
          { userAId: user.id, status: "PENDING", initiatedBy: { not: user.id } },
          { userBId: user.id, status: "PENDING", initiatedBy: { not: user.id } },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            currentRole: true,
            currentCompany: true,
            batchYear: true,
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
            currentRole: true,
            currentCompany: true,
            batchYear: true,
            city: true,
            verificationStatus: true,
            institution: { select: { id: true, name: true, city: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Normalize incoming: the sender is always the other party who initiated
    const incoming = incomingRequests
      .map((r) => {
        const otherUser = r.senderId === user.id ? r.receiver : r.sender;
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          user: otherUser,
        };
      })
      .filter((item) => item.user && item.user.id !== user.id);

    // 2. Outgoing pending requests from me
    const outgoingRequests = await db.connectionRequest.findMany({
      where: {
        OR: [
          { senderId: user.id, status: "PENDING" },
          { userAId: user.id, status: "PENDING", initiatedBy: user.id },
          { userBId: user.id, status: "PENDING", initiatedBy: user.id },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            currentRole: true,
            currentCompany: true,
            batchYear: true,
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
            currentRole: true,
            currentCompany: true,
            batchYear: true,
            city: true,
            verificationStatus: true,
            institution: { select: { id: true, name: true, city: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const outgoing = outgoingRequests
      .map((r) => {
        const otherUser = r.senderId === user.id ? r.receiver : r.sender;
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          user: otherUser,
        };
      })
      .filter((item) => item.user && item.user.id !== user.id);

    // 3. All connected friends (authoritative canonical connections)
    const connectedFriends = await getConnectedFriends(user.id);
    const connectedPeerIds = connectedFriends.map((f) => f.id);
    const connectedPeerIdsSet = new Set(connectedPeerIds);

    // 4. Build status map for all known peers
    const statusMap: Record<string, "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED"> = {};

    connectedPeerIds.forEach((pid) => {
      statusMap[pid] = "CONNECTED";
    });

    incoming.forEach((r) => {
      if (r.user && !connectedPeerIdsSet.has(r.user.id)) {
        statusMap[r.user.id] = "PENDING_INCOMING";
      }
    });

    outgoing.forEach((r) => {
      if (r.user && !connectedPeerIdsSet.has(r.user.id)) {
        statusMap[r.user.id] = "PENDING_OUTGOING";
      }
    });

    // 5. If targetUserId is provided, compute authoritative relationship and mutual count
    let targetRelationship = null;
    let mutualCount = 0;

    if (targetUserId && targetUserId !== user.id) {
      targetRelationship = await getRelationship(user.id, targetUserId);
      statusMap[targetUserId] = targetRelationship.status as any;

      // Calculate mutual friends
      const targetFriends = await getConnectedFriends(targetUserId);
      const targetFriendsSet = new Set(targetFriends.map((f) => f.id));
      connectedPeerIds.forEach((pid) => {
        if (targetFriendsSet.has(pid)) mutualCount++;
      });
    }

    return NextResponse.json({
      success: true,
      incoming,
      outgoing,
      connectedFriends,
      connections: connectedFriends,
      connectedPeerIds,
      statusMap,
      targetRelationship,
      mutualCount,
      unreadRequestsCount: incoming.length,
    });
  } catch (error: any) {
    console.error("Fetch connection requests error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch connection requests" },
      { status: 500 }
    );
  }
}
