import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, getMemberPermissions } from "@/lib/communities/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const user = await getCurrentUser();

    // Find community by id or by slug
    const community = await db.community.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        modules: true,
        roles: { orderBy: { priority: "desc" } },
        channels: { orderBy: { createdAt: "asc" } },
        _count: {
          select: {
            members: true,
            channels: true,
            events: true,
            announcements: true,
            polls: true,
          },
        },
      },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    // Check current user's membership
    let member = null;
    let permissions: Record<string, boolean> = {};

    if (user) {
      member = await db.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: user.id,
          },
        },
        include: { role: true },
      });

      if (member) {
        permissions = getMemberPermissions(member, community);
      }
    }

    // Check visibility permissions
    const isOwner = user?.id === community.ownerId;
    const isMember = !!member && member.status !== "BANNED";

    if (community.discoverability === "HIDDEN" && !isMember && !isOwner) {
      return NextResponse.json({ error: "Community not accessible" }, { status: 403 });
    }

    // Filter channels based on member permissions (hide role-restricted channels member cannot view)
    const accessibleChannels = community.channels.filter((ch) => {
      if (ch.type === "PUBLIC") return true;
      if (!isMember) return false;
      if (isOwner) return true;
      if (ch.type === "ROLE_RESTRICTED" && ch.allowedRoleIds && member?.role) {
        try {
          const allowed = JSON.parse(ch.allowedRoleIds);
          return Array.isArray(allowed) && allowed.includes(member.role.id);
        } catch {
          return false;
        }
      }
      return true;
    });

    return NextResponse.json({
      success: true,
      community: {
        ...community,
        channels: accessibleChannels,
        memberCount: community._count.members,
        channelCount: accessibleChannels.length,
        eventCount: community._count.events,
        pollCount: community._count.polls,
        announcementCount: community._count.announcements,
      },
      membership: member
        ? {
            id: member.id,
            role: member.role,
            status: member.status,
            nickname: member.nickname,
            title: member.title,
            department: member.department,
            teamNumber: member.teamNumber,
            position: member.position,
            joinedAt: member.joinedAt,
          }
        : null,
      permissions,
      isOwner,
      isMember,
    });
  } catch (error: any) {
    console.error("GET /api/communities/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load community" },
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
      include: {
        roles: true,
      },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    const member = await db.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId: user.id,
        },
      },
      include: { role: true },
    });

    const isOwner = user.id === community.ownerId;
    const canManage = isOwner || can(member, "MANAGE_COMMUNITY", community);

    if (!canManage) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      avatarUrl,
      coverUrl,
      discoverability,
      joinMethod,
      joinCode,
      memberListVisibility,
      invitePermission,
      channelCreatePermission,
      callStartPermission,
      isArchived,
      archiveReason,
      newOwnerUserId,
    } = body;

    const updateData: any = {};
    if (typeof name === "string" && name.trim()) updateData.name = name.trim();
    if (typeof description === "string") updateData.description = description.trim();
    if (typeof avatarUrl === "string" || avatarUrl === null) updateData.avatarUrl = avatarUrl;
    if (typeof coverUrl === "string" || coverUrl === null) updateData.coverUrl = coverUrl;
    if (discoverability) updateData.discoverability = discoverability;
    if (joinMethod) updateData.joinMethod = joinMethod;
    if (joinCode !== undefined) updateData.joinCode = joinCode ? String(joinCode).trim() : null;
    if (memberListVisibility) updateData.memberListVisibility = memberListVisibility;
    if (invitePermission) updateData.invitePermission = invitePermission;
    if (channelCreatePermission) updateData.channelCreatePermission = channelCreatePermission;
    if (callStartPermission) updateData.callStartPermission = callStartPermission;

    // Archive / Restore
    if (isArchived === true && !community.archivedAt) {
      updateData.archivedAt = new Date();
      updateData.archiveReason = archiveReason || "Archived by administrator";
    } else if (isArchived === false && community.archivedAt) {
      updateData.archivedAt = null;
      updateData.archiveReason = null;
    }

    // Transfer Ownership (Requires Owner)
    if (newOwnerUserId && newOwnerUserId !== community.ownerId) {
      if (!isOwner) {
        return NextResponse.json({ error: "Only the owner can transfer ownership" }, { status: 403 });
      }

      // Verify new owner is a member
      const targetMember = await db.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: newOwnerUserId,
          },
        },
      });

      if (!targetMember) {
        return NextResponse.json({ error: "Target user is not a member of this community" }, { status: 400 });
      }

      updateData.ownerId = newOwnerUserId;

      // Update role for new owner to OWNER role
      const ownerRole = community.roles.find((r) => r.systemType === "OWNER");
      const adminRole = community.roles.find((r) => r.systemType === "ADMIN");

      if (ownerRole) {
        await db.communityMember.update({
          where: { id: targetMember.id },
          data: { roleId: ownerRole.id },
        });
      }
      if (member && adminRole) {
        // Demote old owner to admin
        await db.communityMember.update({
          where: { id: member.id },
          data: { roleId: adminRole.id },
        });
      }
    }

    const updated = await db.community.update({
      where: { id: community.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, community: updated });
  } catch (error: any) {
    console.error("PUT /api/communities/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update community" },
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

    // Only owner can delete community
    if (community.ownerId !== user.id) {
      return NextResponse.json(
        { error: "Only the community owner can delete this community" },
        { status: 403 }
      );
    }

    await db.community.delete({
      where: { id: community.id },
    });

    return NextResponse.json({ success: true, message: "Community permanently deleted" });
  } catch (error: any) {
    console.error("DELETE /api/communities/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete community" },
      { status: 500 }
    );
  }
}
