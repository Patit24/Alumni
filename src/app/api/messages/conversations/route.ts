import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/messages/conversations - Returns all active conversations with latest message & unread count
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch all direct messages for the current user, ordered newest first
    const allUserMessages = await db.directMessage.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { recipientId: user.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 500, // Sufficient for recent active conversations
    });

    // 2. Aggregate by conversationId
    const conversationsMap = new Map<
      string,
      {
        conversationId: string;
        peerId: string;
        latestMessage: any;
        unreadCount: number;
      }
    >();

    const peerIdsSet = new Set<string>();

    for (const msg of allUserMessages) {
      const peerId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
      peerIdsSet.add(peerId);

      const existing = conversationsMap.get(msg.conversationId);
      if (!existing) {
        conversationsMap.set(msg.conversationId, {
          conversationId: msg.conversationId,
          peerId,
          latestMessage: {
            id: msg.id,
            content: msg.content,
            messageType: msg.messageType,
            senderId: msg.senderId,
            status: msg.status,
            createdAt: msg.createdAt.toISOString(),
          },
          unreadCount: msg.recipientId === user.id && msg.status !== "READ" ? 1 : 0,
        });
      } else {
        if (msg.recipientId === user.id && msg.status !== "READ") {
          existing.unreadCount += 1;
        }
      }
    }

    // 3. Fetch peer profiles in a single query
    const peerProfiles = await db.user.findMany({
      where: { id: { in: Array.from(peerIdsSet) } },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        currentRole: true,
        currentCompany: true,
        batchYear: true,
        verificationStatus: true,
        institution: {
          select: { name: true },
        },
      },
    });

    const peerMap = new Map(peerProfiles.map((p) => [p.id, p]));

    // 4. Construct sorted conversations list (ordered by latest message date)
    const conversations = Array.from(conversationsMap.values())
      .map((conv) => ({
        ...conv,
        peer: peerMap.get(conv.peerId) || null,
      }))
      .filter((conv) => conv.peer !== null)
      .sort(
        (a, b) =>
          new Date(b.latestMessage.createdAt).getTime() -
          new Date(a.latestMessage.createdAt).getTime()
      );

    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Error in GET /api/messages/conversations:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}
