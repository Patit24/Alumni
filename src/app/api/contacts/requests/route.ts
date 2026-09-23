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
            verificationStatus: true,
            institution: { select: { name: true } },
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
            verificationStatus: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. All accepted / connected relationships and message peers
    const [connectedTrusts, acceptedRequests, outgoingRequests, messagePeers] = await Promise.all([
      db.contactTrust.findMany({
        where: {
          userId: user.id,
          trustLevel: { in: ["CONNECTED", "TRUSTED"] },
        },
        select: { contactId: true, trustLevel: true },
      }),
      db.connectionRequest.findMany({
        where: {
          OR: [
            { senderId: user.id, status: "ACCEPTED" },
            { receiverId: user.id, status: "ACCEPTED" },
          ],
        },
        select: { senderId: true, receiverId: true },
      }),
      db.connectionRequest.findMany({
        where: {
          senderId: user.id,
        },
        select: { receiverId: true },
      }),
      db.encryptedMessageQueue.findMany({
        where: {
          OR: [
            { senderId: user.id },
            { recipientId: user.id },
          ],
        },
        select: { senderId: true, recipientId: true },
        take: 100,
      }),
    ]);

    const connectedPeerIdsSet = new Set<string>();
    connectedTrusts.forEach((c) => { if (c.contactId && c.contactId !== user.id) connectedPeerIdsSet.add(c.contactId); });
    acceptedRequests.forEach((r) => {
      if (r.senderId && r.senderId !== user.id) connectedPeerIdsSet.add(r.senderId);
      if (r.receiverId && r.receiverId !== user.id) connectedPeerIdsSet.add(r.receiverId);
    });
    outgoingRequests.forEach((r) => {
      if (r.receiverId && r.receiverId !== user.id) connectedPeerIdsSet.add(r.receiverId);
    });
    messagePeers.forEach((m) => {
      if (m.senderId && m.senderId !== user.id) connectedPeerIdsSet.add(m.senderId);
      if (m.recipientId && m.recipientId !== user.id) connectedPeerIdsSet.add(m.recipientId);
    });

    // Build status lookup map for fast UI status binding
    const statusMap: Record<string, "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED"> = {};

    for (const pid of connectedPeerIdsSet) {
      statusMap[pid] = "CONNECTED";
    }

    for (const req of incoming) {
      if (!statusMap[req.senderId] || statusMap[req.senderId] === "NONE") {
        statusMap[req.senderId] = "PENDING_INCOMING";
      }
    }

    for (const req of outgoing) {
      if (!statusMap[req.receiverId] || statusMap[req.receiverId] === "NONE") {
        statusMap[req.receiverId] = "PENDING_OUTGOING";
      }
    }

    // Check mutual connections if targetUserId is provided
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("targetUserId");
    let mutualCount = 0;
    if (targetUserId) {
      const targetTrusts = await db.contactTrust.findMany({
        where: { userId: targetUserId, trustLevel: { in: ["CONNECTED", "TRUSTED"] } },
        select: { contactId: true },
      });
      const targetConnected = new Set(targetTrusts.map((t) => t.contactId));
      for (const ct of connectedTrusts) {
        if (targetConnected.has(ct.contactId)) mutualCount++;
      }
    }

    return NextResponse.json({
      success: true,
      currentUserId: user.id,
      incoming: incoming.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.sender,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.receiver,
      })),
      connectedPeerIds: Array.from(connectedPeerIdsSet),
      statusMap,
      mutualCount,
      unreadRequestsCount: incoming.length,
    });
  } catch (error) {
    console.error("Fetch connection requests error:", error);
    return NextResponse.json({ error: "Failed to fetch connection requests" }, { status: 500 });
  }
}
