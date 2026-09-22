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

    const community = await db.community.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    const roles = await db.communityRole.findMany({
      where: { communityId: community.id },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { priority: "desc" },
    });

    return NextResponse.json({
      success: true,
      roles: roles.map((r) => ({
        ...r,
        memberCount: r._count.members,
      })),
    });
  } catch (error: any) {
    console.error("GET roles error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load roles" },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const member = await db.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: user.id } },
      include: { role: true },
    });

    const isOwner = user.id === community.ownerId;
    if (!isOwner && !can(member, "MANAGE_COMMUNITY", community)) {
      return NextResponse.json({ error: "Permission denied to create roles" }, { status: 403 });
    }

    const body = await req.json();
    const { name, icon, color, priority = 30, permissions = {} } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }

    const role = await db.communityRole.create({
      data: {
        communityId: community.id,
        name: name.trim(),
        icon: icon || null,
        color: color || "#3b82f6",
        isSystem: false,
        priority: Number(priority),
        canSendMessages: permissions.canSendMessages ?? true,
        canDeleteMessages: permissions.canDeleteMessages ?? false,
        canAddMembers: permissions.canAddMembers ?? false,
        canRemoveMembers: permissions.canRemoveMembers ?? false,
        canInviteMembers: permissions.canInviteMembers ?? true,
        canCreateChannels: permissions.canCreateChannels ?? false,
        canManageCommunity: permissions.canManageCommunity ?? false,
        canCreateEvents: permissions.canCreateEvents ?? false,
        canManageEvents: permissions.canManageEvents ?? false,
        canCreatePolls: permissions.canCreatePolls ?? true,
        canUploadFiles: permissions.canUploadFiles ?? true,
        canDeleteFiles: permissions.canDeleteFiles ?? false,
        canStartCalls: permissions.canStartCalls ?? true,
        canAssignRoles: permissions.canAssignRoles ?? false,
        canCreateAnnouncements: permissions.canCreateAnnouncements ?? false,
        canModerateContent: permissions.canModerateContent ?? false,
        canManageModules: permissions.canManageModules ?? false,
      },
    });

    return NextResponse.json({ success: true, role });
  } catch (error: any) {
    console.error("POST role error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create role" },
      { status: 500 }
    );
  }
}
