import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { COMMUNITY_TEMPLATES } from "@/lib/communities/templates";
import { CommunityType } from "@/lib/communities/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as CommunityType | null;
    const query = searchParams.get("q")?.toLowerCase().trim() || "";

    // 1. Fetch communities the user is a member of
    const myMemberships = await db.communityMember.findMany({
      where: {
        userId: user.id,
        status: { not: "BANNED" },
        ...(type ? { community: { type } } : {}),
        ...(query ? { community: { name: { contains: query } } } : {}),
      },
      include: {
        community: {
          include: {
            owner: { select: { id: true, name: true, avatarUrl: true } },
            roles: true,
            modules: { where: { isEnabled: true } },
            _count: { select: { members: true, channels: true } },
          },
        },
        role: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const myCommunities = myMemberships.map((m) => ({
      ...m.community,
      userRole: m.role,
      userStatus: m.status,
      memberCount: m.community._count.members,
      channelCount: m.community._count.channels,
      isOwner: m.community.ownerId === user.id,
    }));

    const myCommunityIds = new Set(myCommunities.map((c) => c.id));

    // 2. Fetch public discoverable communities the user has NOT joined
    const discoverable = await db.community.findMany({
      where: {
        discoverability: "PUBLIC",
        id: { notIn: Array.from(myCommunityIds) },
        archivedAt: null,
        ...(type ? { type } : {}),
        ...(query ? { name: { contains: query } } : {}),
      },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { members: true } },
      },
      take: 30,
      orderBy: { createdAt: "desc" },
    });

    const discoverableCommunities = discoverable.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      avatarUrl: c.avatarUrl,
      coverUrl: c.coverUrl,
      type: c.type,
      joinMethod: c.joinMethod,
      memberCount: c._count.members,
      owner: c.owner,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({
      success: true,
      myCommunities,
      discoverableCommunities,
    });
  } catch (error: any) {
    console.error("GET /api/communities error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load communities" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description,
      avatarUrl,
      coverUrl,
      type = "CUSTOM",
      discoverability = "MEMBERS_ONLY",
      joinMethod = "INVITE_LINK",
      joinCode,
      memberListVisibility = "EVERYONE",
      invitePermission = "ALL_MEMBERS",
      channelCreatePermission = "ADMINS",
      callStartPermission = "MEMBERS",
      isTemporary = false,
      startDate,
      endDate,
      selectedModules,
      customChannels,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Community name is required" }, { status: 400 });
    }

    const template = COMMUNITY_TEMPLATES[type as CommunityType] || COMMUNITY_TEMPLATES.CUSTOM;
    const finalCover = coverUrl || template.coverPreset;

    // Generate clean slug from name
    const rawSlug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = `${rawSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create Community and associated default structure in a database transaction
    const newCommunity = await db.$transaction(async (tx) => {
      // 1. Create Community
      const comm = await tx.community.create({
        data: {
          slug,
          name: name.trim(),
          description: description?.trim() || template.description,
          avatarUrl: avatarUrl || null,
          coverUrl: finalCover,
          type,
          discoverability,
          joinMethod,
          joinCode: joinCode ? String(joinCode).trim() : null,
          memberListVisibility,
          invitePermission,
          channelCreatePermission,
          callStartPermission,
          isTemporary: Boolean(isTemporary),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          ownerId: user.id,
        },
      });

      // 2. Create Roles from Template
      const roleMap: Record<string, string> = {};
      let ownerRoleId = "";

      for (const r of template.defaultRoles) {
        const createdRole = await tx.communityRole.create({
          data: {
            communityId: comm.id,
            name: r.name,
            isSystem: true,
            systemType: r.systemType,
            priority: r.priority,
            color: r.color,
            canSendMessages: r.permissions.SEND_MESSAGES ?? true,
            canDeleteMessages: r.permissions.DELETE_MESSAGES ?? false,
            canAddMembers: r.permissions.ADD_MEMBERS ?? false,
            canRemoveMembers: r.permissions.REMOVE_MEMBERS ?? false,
            canInviteMembers: r.permissions.INVITE_MEMBERS ?? true,
            canCreateChannels: r.permissions.CREATE_CHANNELS ?? false,
            canManageCommunity: r.permissions.MANAGE_COMMUNITY ?? false,
            canCreateEvents: r.permissions.CREATE_EVENTS ?? false,
            canManageEvents: r.permissions.MANAGE_EVENTS ?? false,
            canCreatePolls: r.permissions.CREATE_POLLS ?? true,
            canUploadFiles: r.permissions.UPLOAD_FILES ?? true,
            canDeleteFiles: r.permissions.DELETE_FILES ?? false,
            canStartCalls: r.permissions.START_CALLS ?? true,
            canAssignRoles: r.permissions.ASSIGN_ROLES ?? false,
            canCreateAnnouncements: r.permissions.CREATE_ANNOUNCEMENTS ?? false,
            canModerateContent: r.permissions.MODERATE_CONTENT ?? false,
            canManageModules: r.permissions.MANAGE_MODULES ?? false,
          },
        });

        roleMap[r.systemType] = createdRole.id;
        if (r.systemType === "OWNER") {
          ownerRoleId = createdRole.id;
        }
      }

      // 3. Add Creator as OWNER member
      await tx.communityMember.create({
        data: {
          communityId: comm.id,
          userId: user.id,
          roleId: ownerRoleId,
          title: "Creator",
          status: "ACTIVE",
        },
      });

      // 4. Create Modules
      const modulesToEnable: string[] = Array.isArray(selectedModules) && selectedModules.length > 0
        ? selectedModules
        : template.recommendedModules;

      for (const modKey of modulesToEnable) {
        await tx.communityModule.create({
          data: {
            communityId: comm.id,
            moduleKey: modKey,
            isEnabled: true,
          },
        });
      }

      // 5. Create Default Channels
      const channelsToCreate = Array.isArray(customChannels) && customChannels.length > 0
        ? customChannels
        : template.defaultChannels;

      for (const ch of channelsToCreate) {
        await tx.communityChannel.create({
          data: {
            communityId: comm.id,
            name: ch.name.toLowerCase().replace(/[^a-z0-9-_]/g, ""),
            description: ch.description || null,
            type: ch.type || "PUBLIC",
            isAnnouncementOnly: ch.name === "announcements",
          },
        });
      }

      return comm;
    });

    return NextResponse.json({
      success: true,
      community: newCommunity,
    });
  } catch (error: any) {
    console.error("POST /api/communities error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create community" },
      { status: 500 }
    );
  }
}
