import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastFeedEvent } from "@/lib/supabase-broadcast";

export const dynamic = "force-dynamic";

// GET /api/groups/[id]/members - List alumni eligible to be invited/added to this group
export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await props.params;

    const group = await db.group.findUnique({
      where: { id: groupId },
      include: {
        members: { select: { userId: true } },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const existingMemberIds = group.members.map((m) => m.userId);

    // Filter available alumni: same institution (and if same_batch group, same batchYear)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      institutionId: group.institutionId,
      id: { notIn: existingMemberIds },
    };

    if (group.scope === "SAME_BATCH" && group.batchYear) {
      where.batchYear = group.batchYear;
    }

    const availableUsers = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        batchYear: true,
        currentRole: true,
        currentCompany: true,
        verificationStatus: true,
      },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      availableUsers,
    });
  } catch (error) {
    console.error("Group members GET error:", error);
    return NextResponse.json({ error: "Failed to fetch candidate members" }, { status: 500 });
  }
}

// POST /api/groups/[id]/members - Add an alumnus to the group
export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await props.params;
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    // Add to group member
    await db.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      update: {},
      create: {
        groupId,
        userId,
        role: "MEMBER",
      },
    });

    // Create a system message in the chat
    const sysMsg = await db.chatMessage.create({
      data: {
        groupId,
        senderId: user.id,
        content: `${user.name} added ${targetUser.name} to the group 🎉`,
        type: "SYSTEM",
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            batchYear: true,
            currentRole: true,
            currentCompany: true,
            verificationStatus: true,
          },
        },
      },
    });

    // Broadcast system message over Supabase Realtime
    await broadcastFeedEvent(groupId, "new-chat-message", sysMsg);

    return NextResponse.json({
      success: true,
      message: `${targetUser.name} added to the group`,
    });
  } catch (error) {
    console.error("Group members POST error:", error);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}
