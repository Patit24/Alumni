import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  unfriendUser,
  getRelationship,
} from "@/lib/connection-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId, action } = body as {
      targetUserId?: string;
      action?: "REQUEST" | "ACCEPT" | "REJECT" | "CANCEL" | "BLOCK" | "UNFRIEND";
    };

    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Cannot connect with yourself" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, username: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 1. ACTION: REQUEST
    if (action === "REQUEST") {
      const rel = await sendConnectionRequest(user.id, targetUserId);
      return NextResponse.json({
        success: true,
        status: rel.status,
        isFriend: rel.isFriend,
        relationship: rel,
        message: rel.isFriend
          ? `Connected with ${targetUser.name}!`
          : `Connection request sent to ${targetUser.name}`,
      });
    }

    // 2. ACTION: ACCEPT
    if (action === "ACCEPT") {
      const rel = await acceptConnectionRequest(user.id, targetUserId);
      return NextResponse.json({
        success: true,
        status: rel.status,
        isFriend: rel.isFriend,
        relationship: rel,
        message: `Connected with ${targetUser.name}!`,
      });
    }

    // 3. ACTION: REJECT
    if (action === "REJECT") {
      const rel = await rejectConnectionRequest(user.id, targetUserId);
      return NextResponse.json({
        success: true,
        status: rel.status,
        isFriend: false,
        relationship: rel,
      });
    }

    // 4. ACTION: CANCEL
    if (action === "CANCEL") {
      const rel = await cancelConnectionRequest(user.id, targetUserId);
      return NextResponse.json({
        success: true,
        status: rel.status,
        isFriend: false,
        relationship: rel,
      });
    }

    // 5. ACTION: BLOCK
    if (action === "BLOCK") {
      await db.userBlock.upsert({
        where: {
          blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId },
        },
        update: {},
        create: { blockerId: user.id, blockedId: targetUserId },
      });

      // Also clean up any active connection when blocking
      await unfriendUser(user.id, targetUserId).catch(() => {});

      return NextResponse.json({
        success: true,
        status: "BLOCKED",
        isFriend: false,
      });
    }

    // 6. ACTION: UNFRIEND
    if (action === "UNFRIEND") {
      const rel = await unfriendUser(user.id, targetUserId);
      return NextResponse.json({
        success: true,
        status: rel.status,
        isFriend: false,
        relationship: rel,
        message: `Removed from friends`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Connection API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process connection request" },
      { status: 500 }
    );
  }
}

// GET /api/contacts/connect?targetUserId=...
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("targetUserId");
    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    const relationship = await getRelationship(user.id, targetUserId);
    return NextResponse.json({
      success: true,
      relationship,
      status: relationship.status,
      isFriend: relationship.isFriend,
    });
  } catch (error: any) {
    console.error("Relationship lookup error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to query relationship" },
      { status: 500 }
    );
  }
}
