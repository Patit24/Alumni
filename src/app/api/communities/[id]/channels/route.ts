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

    const channels = await db.communityChannel.findMany({
      where: { communityId: community.id },
      include: {
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const accessible = channels.filter((ch) => {
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
      channels: accessible.map((c) => ({
        ...c,
        messageCount: c._count.messages,
      })),
    });
  } catch (error: any) {
    console.error("GET /api/communities/[id]/channels error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load channels" },
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

    if (!can(member, "CREATE_CHANNELS", community)) {
      return NextResponse.json(
        { error: "You do not have permission to create channels in this community" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description, icon, type = "PUBLIC", allowedRoleIds, isAnnouncementOnly = false } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Channel name is required" }, { status: 400 });
    }

    const cleanName = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/^-+|-+$/g, "");

    const channel = await db.communityChannel.create({
      data: {
        communityId: community.id,
        name: cleanName,
        description: description?.trim() || null,
        icon: icon || null,
        type,
        allowedRoleIds: Array.isArray(allowedRoleIds) ? JSON.stringify(allowedRoleIds) : null,
        isAnnouncementOnly: Boolean(isAnnouncementOnly),
      },
    });

    return NextResponse.json({ success: true, channel });
  } catch (error: any) {
    console.error("POST /api/communities/[id]/channels error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create channel" },
      { status: 500 }
    );
  }
}
