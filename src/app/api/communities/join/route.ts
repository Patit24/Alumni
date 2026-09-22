import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token, communityId, note } = body;

    // Flow 1: Join via Invite Token or QR payload token
    if (token) {
      const invite = await db.communityInvite.findUnique({
        where: { token },
        include: {
          community: {
            include: {
              roles: {
                where: { isSystem: true, systemType: "MEMBER" },
              },
            },
          },
        },
      });

      if (!invite || invite.isRevoked) {
        return NextResponse.json({ error: "Invalid or revoked invite token" }, { status: 404 });
      }

      if (invite.expiresAt && new Date() > invite.expiresAt) {
        return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
      }

      if (invite.maxUses && invite.usedCount >= invite.maxUses) {
        return NextResponse.json({ error: "This invite link has reached its maximum uses" }, { status: 410 });
      }

      // Check if already a member
      const existingMember = await db.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: invite.communityId,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        if (existingMember.status === "BANNED") {
          return NextResponse.json({ error: "You are banned from this community" }, { status: 403 });
        }
        return NextResponse.json({ 
          success: true, 
          message: "Already a member", 
          communityId: invite.communityId 
        });
      }

      // Default role or assigned role
      const memberRole = invite.assignedRoleId || invite.community.roles[0]?.id;
      if (!memberRole) {
        return NextResponse.json({ error: "No available role found for community" }, { status: 500 });
      }

      // Create membership & increment uses in a transaction
      await db.$transaction([
        db.communityMember.create({
          data: {
            communityId: invite.communityId,
            userId: user.id,
            roleId: memberRole,
            status: "ACTIVE",
          },
        }),
        db.communityInvite.update({
          where: { id: invite.id },
          data: { usedCount: { increment: 1 } },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: "Successfully joined community",
        communityId: invite.communityId,
      });
    }

    // Flow 2: Direct or Request Join
    if (communityId) {
      const community = await db.community.findUnique({
        where: { id: communityId },
        include: {
          roles: {
            where: { isSystem: true, systemType: "MEMBER" },
          },
        },
      });

      if (!community) {
        return NextResponse.json({ error: "Community not found" }, { status: 404 });
      }

      const existingMember = await db.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        if (existingMember.status === "BANNED") {
          return NextResponse.json({ error: "You are banned from this community" }, { status: 403 });
        }
        return NextResponse.json({ 
          success: true, 
          message: "Already a member", 
          communityId 
        });
      }

      // If approval required or restricted
      if (community.joinMethod === "REQUEST_APPROVAL" || community.joinMethod === "INVITE_ONLY") {
        const existingRequest = await db.communityJoinRequest.findUnique({
          where: {
            communityId_userId: {
              communityId,
              userId: user.id,
            },
          },
        });

        if (existingRequest && existingRequest.status === "PENDING") {
          return NextResponse.json({ 
            success: true, 
            status: "PENDING", 
            message: "Join request is already pending approval" 
          });
        }

        const request = await db.communityJoinRequest.upsert({
          where: {
            communityId_userId: {
              communityId,
              userId: user.id,
            },
          },
          create: {
            communityId,
            userId: user.id,
            note: note || null,
            status: "PENDING",
          },
          update: {
            note: note || null,
            status: "PENDING",
          },
        });

        return NextResponse.json({
          success: true,
          status: "PENDING",
          message: "Join request submitted for review",
          request,
        });
      }

      // Direct open join
      const defaultRole = community.roles[0]?.id;
      if (!defaultRole) {
        return NextResponse.json({ error: "Community has no default role configured" }, { status: 500 });
      }

      await db.communityMember.create({
        data: {
          communityId,
          userId: user.id,
          roleId: defaultRole,
          status: "ACTIVE",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Successfully joined community",
        communityId,
      });
    }

    return NextResponse.json({ error: "Missing token or communityId" }, { status: 400 });
  } catch (error: any) {
    console.error("Join community error:", error);
    return NextResponse.json({ error: error.message || "Failed to join community" }, { status: 500 });
  }
}
