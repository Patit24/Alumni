import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensurePeerUserExists } from "@/lib/connection-service";

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
    const peerProfiles: any[] = await db.user.findMany({
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

    // Self-heal any peer rows whose name was defaulted to "Alumni Member"
    for (const p of peerProfiles) {
      if (p.name === "Alumni Member") {
        try {
          const notif = await db.appNotification.findFirst({
            where: { actorId: p.id },
            orderBy: { createdAt: "desc" },
          });
          if (notif?.data) {
            const parsed = JSON.parse(notif.data);
            const candName = parsed.peerName || parsed.senderName;
            if (candName && candName.trim() !== "Alumni Member") {
              p.name = candName.trim();
              if (parsed.peerUsername) p.username = parsed.peerUsername;
              if (parsed.peerAvatarUrl) p.avatarUrl = parsed.peerAvatarUrl;
              db.user.update({
                where: { id: p.id },
                data: { name: p.name, username: p.username, avatarUrl: p.avatarUrl },
              }).catch(() => {});
            }
          }
        } catch {}
      }
    }

    // Ensure missing peers in this serverless container are reconstituted
    const foundPeerIds = new Set(peerProfiles.map((p) => p.id));
    for (const pid of peerIdsSet) {
      if (!foundPeerIds.has(pid)) {
        try {
          const healed = await ensurePeerUserExists(pid, user);
          if (healed) {
            peerProfiles.push({
              id: healed.id,
              name: healed.name,
              username: healed.username,
              avatarUrl: healed.avatarUrl,
              currentRole: healed.currentRole,
              currentCompany: healed.currentCompany,
              batchYear: healed.batchYear,
              verificationStatus: healed.verificationStatus,
              institution: healed.institution ? { name: healed.institution.name } : null,
            });
          }
        } catch {}
      }
    }

    const peerMap = new Map(peerProfiles.map((p) => [p.id, p]));

    // 4. Construct sorted conversations list (ordered by latest message date)
    const conversations = Array.from(conversationsMap.values())
      .map((conv) => {
        const peer = peerMap.get(conv.peerId) || null;
        return {
          ...conv,
          latestMessage: {
            ...conv.latestMessage,
            senderName: conv.latestMessage.senderId === user.id ? user.name : (peer?.name || undefined),
          },
          peer,
        };
      })
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
