import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/communities/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const user = await getCurrentUser();

    const community = await db.community.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        roles: true,
      },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    let member = null;
    if (user) {
      member = await db.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId: user.id } },
        include: { role: true },
      });
    }

    const isOwner = user?.id === community.ownerId;
    const isMember = !!member && member.status !== "BANNED";

    // Privacy rule for member list visibility
    if (community.memberListVisibility === "ADMINS_ONLY" && !isOwner && !member?.role?.canManageCommunity) {
      return NextResponse.json(
        { error: "Member list is restricted to community administrators" },
        { status: 403 }
      );
    }

    if (community.memberListVisibility === "MEMBERS_ONLY" && !isMember && !isOwner) {
      return NextResponse.json(
        { error: "Member list is restricted to community members" },
        { status: 403 }
      );
    }

    const members = await db.communityMember.findMany({
      where: {
        communityId: community.id,
        status: { not: "BANNED" },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            verificationStatus: true,
          },
        },
        role: true,
      },
      orderBy: [
        { role: { priority: "desc" } },
        { joinedAt: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.nickname || m.user.name,
        realName: m.user.name,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        verificationStatus: m.user.verificationStatus,
        role: m.role,
        title: m.title,
        department: m.department,
        teamNumber: m.teamNumber,
        position: m.position,
        status: m.status,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error: any) {
    console.error("GET community members error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load members" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const community = await db.community.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    const currentMember = await db.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: user.id } },
      include: { role: true },
    });

    const isOwner = user.id === community.ownerId;
    const body = await req.json();
    const { memberId, roleId, status, nickname, title, department, teamNumber, position } = body;

    const targetMember = await db.communityMember.findUnique({
      where: { id: memberId },
      include: { role: true },
    });

    if (!targetMember || targetMember.communityId !== community.id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isTargetSelf = targetMember.userId === user.id;

    // Modifying role or status requires ASSIGN_ROLES or MANAGE_COMMUNITY permission
    if (roleId || status) {
      const canAssign = isOwner || can(currentMember, "ASSIGN_ROLES", community);
      if (!canAssign) {
        return NextResponse.json({ error: "Permission denied to alter member role or status" }, { status: 403 });
      }

      // Cannot modify community owner
      if (targetMember.userId === community.ownerId && !isOwner) {
        return NextResponse.json({ error: "Cannot modify owner's role" }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (roleId) updateData.roleId = roleId;
    if (status) updateData.status = status;
    if (nickname !== undefined) updateData.nickname = nickname ? String(nickname).trim() : null;
    if (title !== undefined) updateData.title = title ? String(title).trim() : null;
    if (department !== undefined) updateData.department = department ? String(department).trim() : null;
    if (teamNumber !== undefined) updateData.teamNumber = teamNumber !== null ? Number(teamNumber) : null;
    if (position !== undefined) updateData.position = position ? String(position).trim() : null;

    const updated = await db.communityMember.update({
      where: { id: targetMember.id },
      data: updateData,
      include: { role: true },
    });

    return NextResponse.json({ success: true, member: updated });
  } catch (error: any) {
    console.error("PUT community member error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const community = await db.community.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    const currentMember = await db.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: user.id } },
      include: { role: true },
    });

    const isOwner = user.id === community.ownerId;
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    const ban = searchParams.get("ban") === "true";

    if (!memberId) {
      return NextResponse.json({ error: "memberId parameter is required" }, { status: 400 });
    }

    const targetMember = await db.communityMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.communityId !== community.id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isSelfLeaving = targetMember.userId === user.id;

    if (!isSelfLeaving) {
      const canRemove = isOwner || can(currentMember, "REMOVE_MEMBERS", community);
      if (!canRemove) {
        return NextResponse.json({ error: "Permission denied to remove members" }, { status: 403 });
      }

      if (targetMember.userId === community.ownerId) {
        return NextResponse.json({ error: "Community owner cannot be removed" }, { status: 400 });
      }
    }

    if (ban) {
      await db.communityMember.update({
        where: { id: targetMember.id },
        data: { status: "BANNED" },
      });
    } else {
      await db.communityMember.delete({
        where: { id: targetMember.id },
      });
    }

    return NextResponse.json({
      success: true,
      message: isSelfLeaving ? "You left the community" : ban ? "Member banned" : "Member removed",
    });
  } catch (error: any) {
    console.error("DELETE community member error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove member" },
      { status: 500 }
    );
  }
}
