import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Incoming pending requests to me
    const incoming = await db.connectionRequest.findMany({
      where: {
        receiverId: user.id,
        status: "PENDING",
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
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Outgoing pending requests from me
    const outgoing = await db.connectionRequest.findMany({
      where: {
        senderId: user.id,
        status: "PENDING",
      },
      include: {
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

    // 3. All accepted / connected relationships and message peers (bidirectional)
    const [connectedTrusts, acceptedRequests, messagePeers] = await Promise.all([
      db.contactTrust.findMany({
        where: {
          OR: [{ userId: user.id }, { contactId: user.id }],
          trustLevel: { in: ["CONNECTED", "TRUSTED"] },
        },
        select: { userId: true, contactId: true, trustLevel: true },
      }),
      db.connectionRequest.findMany({
        where: {
          OR: [
            { senderId: user.id, status: { in: ["ACCEPTED", "CONNECTED"] } },
            { receiverId: user.id, status: { in: ["ACCEPTED", "CONNECTED"] } },
          ],
        },
        select: { senderId: true, receiverId: true },
      }),
      db.encryptedMessageQueue.findMany({
        where: {
          OR: [
            { senderId: user.id },
            { recipientId: user.id },
          ],
        },
        select: { senderId: true, recipientId: true },
        take: 200,
      }),
    ]);

    const connectedPeerIdsSet = new Set<string>();
    connectedTrusts.forEach((c) => {
      if (c.userId && c.userId !== user.id) connectedPeerIdsSet.add(c.userId);
      if (c.contactId && c.contactId !== user.id) connectedPeerIdsSet.add(c.contactId);
    });
    acceptedRequests.forEach((r) => {
      if (r.senderId && r.senderId !== user.id) connectedPeerIdsSet.add(r.senderId);
      if (r.receiverId && r.receiverId !== user.id) connectedPeerIdsSet.add(r.receiverId);
    });
    messagePeers.forEach((m) => {
      if (m.senderId && m.senderId !== user.id) connectedPeerIdsSet.add(m.senderId);
      if (m.recipientId && m.recipientId !== user.id) connectedPeerIdsSet.add(m.recipientId);
    });

    // Fetch full user profiles for all connected peers
    const connectedPeerIds = Array.from(connectedPeerIdsSet);
    const connectedUsers = connectedPeerIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: connectedPeerIds } },
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
            isOpenToMentor: true,
            institution: { select: { id: true, name: true, city: true } },
            department: { select: { id: true, name: true } },
          },
          orderBy: { name: "asc" },
        })
      : [];

    // Build status lookup map for fast UI status binding
    const statusMap: Record<string, "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED"> = {};

    for (const pid of connectedPeerIdsSet) {
      statusMap[pid] = "CONNECTED";
    }

    for (const req of incoming) {
      if (statusMap[req.senderId] !== "CONNECTED") {
        statusMap[req.senderId] = "PENDING_INCOMING";
      }
    }

    for (const req of outgoing) {
      if (statusMap[req.receiverId] !== "CONNECTED") {
        statusMap[req.receiverId] = "PENDING_OUTGOING";
      }
    }

    // Check mutual connections if targetUserId is provided
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("targetUserId");
    let mutualCount = 0;
    if (targetUserId) {
      // Direct authoritative check: is this specific user-target pair connected?
      // This is the primary fix for statusMap missing the targetUserId after accept.
      const [directTrust, directRequest] = await Promise.all([
        db.contactTrust.findFirst({
          where: {
            OR: [
              { userId: user.id, contactId: targetUserId, trustLevel: { in: ["CONNECTED", "TRUSTED"] } },
              { userId: targetUserId, contactId: user.id, trustLevel: { in: ["CONNECTED", "TRUSTED"] } },
            ],
          },
        }),
        db.connectionRequest.findFirst({
          where: {
            OR: [
              { senderId: user.id, receiverId: targetUserId, status: { in: ["ACCEPTED", "CONNECTED"] } },
              { senderId: targetUserId, receiverId: user.id, status: { in: ["ACCEPTED", "CONNECTED"] } },
            ],
          },
        }),
      ]);

      // If either source confirms connection, mark as CONNECTED in statusMap
      if (directTrust || directRequest) {
        statusMap[targetUserId] = "CONNECTED";
      }

      const targetTrusts = await db.contactTrust.findMany({
        where: {
          OR: [{ userId: targetUserId }, { contactId: targetUserId }],
          trustLevel: { in: ["CONNECTED", "TRUSTED"] },
        },
        select: { userId: true, contactId: true },
      });
      const targetConnected = new Set<string>();
      targetTrusts.forEach((t) => {
        if (t.userId !== targetUserId) targetConnected.add(t.userId);
        if (t.contactId !== targetUserId) targetConnected.add(t.contactId);
      });
      for (const pid of connectedPeerIdsSet) {
        if (targetConnected.has(pid)) mutualCount++;
      }
    }

    return NextResponse.json({
      success: true,
      currentUserId: user.id,
      incoming: incoming.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.sender,
        sender: r.sender,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.receiver,
        receiver: r.receiver,
      })),
      connections: connectedUsers,
      connectedPeerIds,
      statusMap,
      mutualCount,
      unreadRequestsCount: incoming.length,
    });
  } catch (error) {
    console.error("Fetch connection requests error:", error);
    return NextResponse.json({ error: "Failed to fetch connection requests" }, { status: 500 });
  }
}
