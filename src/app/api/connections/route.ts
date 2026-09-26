import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canonicalUserPair,
  ensurePeerUserExists,
  getConnectionRelationship,
  sendConnectionInvitation,
  acceptConnectionInvitation,
  withdrawConnectionInvitation,
  ignoreConnectionInvitation,
  removeConnection,
  getMyConnections,
  getInvitations,
  getPeopleYouMayKnow,
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
    const type = searchParams.get("type");
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const clientPeersParam = searchParams.get("clientPeers");
    const clientProfilesParam = searchParams.get("clientProfiles");

    const profilesMap = new Map<string, any>();
    if (clientProfilesParam) {
      try {
        const parsed = JSON.parse(clientProfilesParam);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (p?.id && p.id !== user.id) {
              profilesMap.set(p.id, p);
            }
          }
        }
      } catch {}
    }

    // Collect all peer IDs from clientPeers or clientProfiles to self-heal
    const peerIdsToHeal = new Set<string>();
    if (clientPeersParam) {
      clientPeersParam
        .split(",")
        .map((s) => s.trim())
        .filter((id) => id && id !== user.id)
        .forEach((id) => peerIdsToHeal.add(id));
    }
    profilesMap.forEach((_, id) => peerIdsToHeal.add(id));

    if (peerIdsToHeal.size > 0) {
      for (const peerId of peerIdsToHeal) {
        try {
          const profileData = profilesMap.get(peerId);
          // 1. Ensure peer user exists in this SQLite container with real profile data if provided
          await ensurePeerUserExists(peerId, user, profileData);

          // 2. Ensure connection request exists and is ACCEPTED
          const { userAId, userBId } = canonicalUserPair(user.id, peerId);
          const existing = await db.connectionRequest.findFirst({
            where: {
              OR: [
                { userAId, userBId },
                { senderId: user.id, receiverId: peerId },
                { senderId: peerId, receiverId: user.id },
              ],
            },
          });
          if (!existing) {
            await db.connectionRequest.create({
              data: {
                userAId,
                userBId,
                senderId: user.id,
                receiverId: peerId,
                initiatedBy: user.id,
                status: "ACCEPTED",
                acceptedAt: new Date(),
              },
            });
          } else if (existing.status !== "ACCEPTED" && existing.status !== "CONNECTED") {
            await db.connectionRequest.update({
              where: { id: existing.id },
              data: {
                status: "ACCEPTED",
                acceptedAt: existing.acceptedAt || new Date(),
              },
            });
          }
        } catch (healErr) {
          console.warn(`[GET /api/connections] Error healing peer ${peerId}:`, healErr);
        }
      }
    }

    // 1. Single user relationship lookup
    if (targetUserId) {
      const relationship = await getConnectionRelationship(user.id, targetUserId);
      return NextResponse.json({ success: true, relationship });
    }

    // 2. Invitations (Received & Sent)
    if (type === "invitations") {
      const invitations = await getInvitations(user.id);
      return NextResponse.json({ success: true, ...invitations });
    }

    // 3. 1st-Degree Connections List
    if (type === "connections") {
      const connections = await getMyConnections(user.id, search);
      return NextResponse.json({ success: true, connections, total: connections.length });
    }

    // 4. Suggestions / "People You May Know"
    if (type === "suggestions") {
      const suggestions = await getPeopleYouMayKnow(user.id, limit);
      return NextResponse.json({ success: true, suggestions });
    }

    // 5. Full Network Hub summary (default)
    const [connections, invitations, suggestions] = await Promise.all([
      getMyConnections(user.id),
      getInvitations(user.id),
      getPeopleYouMayKnow(user.id, 12),
    ]);

    return NextResponse.json({
      success: true,
      connectionsCount: connections.length,
      invitationsCount: invitations.received.length,
      receivedInvitations: invitations.received,
      sentInvitations: invitations.sent,
      connections,
      suggestions,
    });
  } catch (error: any) {
    console.error("GET /api/connections error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch connections data" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, targetUserId, message } = body;

    // SYNC action: restores accepted connections from client's knownPeerIds
    if (action === "SYNC") {
      const knownPeerIds: string[] = Array.isArray(body.knownPeerIds) ? body.knownPeerIds : [];
      const knownProfiles: any[] = Array.isArray(body.knownProfiles) ? body.knownProfiles : [];
      const profileMap = new Map<string, any>();
      knownProfiles.forEach((p) => { if (p?.id) profileMap.set(p.id, p); });

      for (const peerId of knownPeerIds) {
        if (!peerId || peerId === user.id) continue;
        try {
          // Ensure peer user exists in this SQLite container
          await ensurePeerUserExists(peerId, user, profileMap.get(peerId));

          const { userAId, userBId } = canonicalUserPair(user.id, peerId);
          const existing = await db.connectionRequest.findFirst({
            where: {
              OR: [
                { userAId, userBId },
                { senderId: user.id, receiverId: peerId },
                { senderId: peerId, receiverId: user.id },
              ],
            },
          });
          if (!existing) {
            await db.connectionRequest.create({
              data: {
                userAId,
                userBId,
                senderId: user.id,
                receiverId: peerId,
                initiatedBy: user.id,
                status: "ACCEPTED",
                acceptedAt: new Date(),
              },
            });
          } else if (existing.status !== "ACCEPTED" && existing.status !== "CONNECTED") {
            await db.connectionRequest.update({
              where: { id: existing.id },
              data: { status: "ACCEPTED", acceptedAt: existing.acceptedAt || new Date() },
            });
          }
        } catch (syncErr) {
          console.warn(`[POST /api/connections SYNC] Error syncing peer ${peerId}:`, syncErr);
        }
      }
      const connections = await getMyConnections(user.id);
      return NextResponse.json({ success: true, connections, total: connections.length });
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    if (user.id === targetUserId) {
      return NextResponse.json({ error: "Cannot perform action on yourself" }, { status: 400 });
    }

    let relationship;

    switch (action) {
      case "CONNECT":
      case "SEND_REQUEST":
        relationship = await sendConnectionInvitation(user.id, targetUserId, message);
        break;

      case "ACCEPT":
      case "ACCEPT_REQUEST":
        relationship = await acceptConnectionInvitation(user.id, targetUserId);
        break;

      case "IGNORE":
      case "REJECT":
      case "DECLINE":
        relationship = await ignoreConnectionInvitation(user.id, targetUserId);
        break;

      case "WITHDRAW":
      case "CANCEL":
        relationship = await withdrawConnectionInvitation(user.id, targetUserId);
        break;

      case "REMOVE":
      case "UNFRIEND":
      case "DISCONNECT":
        relationship = await removeConnection(user.id, targetUserId);
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      relationship,
    });
  } catch (error: any) {
    console.error("POST /api/connections error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process connection action" },
      { status: 500 }
    );
  }
}
