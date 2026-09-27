import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/groups - List groups for user's university and batch
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scopeFilter = searchParams.get("scope") || "ALL"; // "ALL", "SAME_BATCH", "INSTITUTION"

    const where: Prisma.GroupWhereInput = {
      institutionId: user.institutionId,
    };

    if (scopeFilter === "SAME_BATCH") {
      where.scope = "SAME_BATCH";
      where.batchYear = user.batchYear;
    } else if (scopeFilter === "INSTITUTION") {
      where.scope = "INSTITUTION";
    }

    // Secret groups are completely hidden from non-members; only members can track/see them
    where.OR = [
      { isSecretMode: false },
      {
        isSecretMode: true,
        members: { some: { userId: user.id } },
      },
    ];

    const groups = await db.group.findMany({
      where,
      include: {
        _count: {
          select: { members: true, messages: true },
        },
        members: {
          where: { userId: user.id },
          select: { role: true },
        },
        createdBy: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const formatted = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      scope: g.scope,
      batchYear: g.batchYear,
      isSecretMode: g.isSecretMode,
      allowScreenshot: g.allowScreenshot,
      memberCount: g._count.members,
      messageCount: g._count.messages,
      isMember: g.members.length > 0,
      role: g.members[0]?.role || null,
      createdByName: g.createdBy.name,
      createdAt: g.createdAt,
    }));

    return NextResponse.json({
      currentUser: {
        id: user.id,
        name: user.name,
        batchYear: user.batchYear,
        institutionName: user.institution.name,
      },
      groups: formatted,
    });
  } catch (error) {
    console.error("Groups GET error:", error);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}

// POST /api/groups - Create a new group (WhatsApp style)
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, scope, avatar, memberIds, isSecretMode, allowScreenshot } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Group name is required." }, { status: 400 });
    }

    const isBatchScope = scope === "SAME_BATCH";

    // Deduplicate participant IDs excluding creator
    const uniqueMemberIds: string[] = Array.isArray(memberIds)
      ? Array.from(new Set(memberIds.filter((id: unknown): id is string => typeof id === "string" && Boolean(id) && id !== user.id)))
      : [];

    const memberCreations = [
      { userId: user.id, role: "ADMIN" },
      ...uniqueMemberIds.map((uid) => ({ userId: uid, role: "MEMBER" })),
    ];

    const group = await db.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        avatar: avatar || null,
        scope: isBatchScope ? "SAME_BATCH" : "INSTITUTION",
        batchYear: isBatchScope ? user.batchYear : null,
        institutionId: user.institutionId,
        createdById: user.id,
        isSecretMode: Boolean(isSecretMode),
        allowScreenshot: allowScreenshot !== undefined ? Boolean(allowScreenshot) : false,
        members: {
          create: memberCreations,
        },
      },
    });

    // Create a welcoming system message (WhatsApp style)
    await db.chatMessage.create({
      data: {
        groupId: group.id,
        senderId: user.id,
        content: uniqueMemberIds.length > 0
          ? `${user.name} created group "${group.name}" with ${uniqueMemberIds.length + 1} participants.`
          : `${user.name} created group "${group.name}".`,
        type: "SYSTEM",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Group created successfully!",
      group,
    });
  } catch (error) {
    console.error("Groups POST error:", error);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
