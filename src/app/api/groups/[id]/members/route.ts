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

// DELETE /api/groups/[id]/members - Remove a member or exit group
export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await props.params;
    const { searchParams } = new URL(req.url);
    let targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      try {
        const body = await req.json();
        targetUserId = body?.userId;
      } catch {}
    }

    if (!targetUserId) {
      targetUserId = user.id; // Defaults to self (Exit Group)
    }

    const group = await db.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const isSelf = targetUserId === user.id;
    const callerMember = group.members.find((m) => m.userId === user.id);
    const isCallerAdmin = group.createdById === user.id || callerMember?.role === "ADMIN";

    // Non-admins can only remove themselves (Exit Group)
    if (!isSelf && !isCallerAdmin) {
      return NextResponse.json(
        { error: "Only group admins can remove other members" },
        { status: 403 }
      );
    }

    // Check if target member exists in group
    const targetMember = group.members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      return NextResponse.json({ error: "User is not a member of this group" }, { status: 404 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true },
    });

    // Delete membership
    await db.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
    });

    // Admin Succession: If exiting user was an admin and no other admins remain, promote oldest member
    if (targetMember.role === "ADMIN" || group.createdById === targetUserId) {
      const remainingMembers = group.members.filter((m) => m.userId !== targetUserId);
      const remainingAdmins = remainingMembers.filter((m) => m.role === "ADMIN");

      if (remainingAdmins.length === 0 && remainingMembers.length > 0) {
        const successor = remainingMembers.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
        await db.groupMember.update({
          where: { id: successor.id },
          data: { role: "ADMIN" },
        });

        const succUser = await db.user.findUnique({
          where: { id: successor.userId },
          select: { name: true },
        });

        if (succUser) {
          const succMsg = await db.chatMessage.create({
            data: {
              groupId,
              senderId: user.id,
              content: `${succUser.name} is now a group admin 👑`,
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
          broadcastFeedEvent(groupId, "new-chat-message", succMsg).catch(() => {});
        }
      }
    }

    // Create system message
    const actionText = isSelf
      ? `${targetUser?.name || "A member"} left the group`
      : `${user.name} removed ${targetUser?.name || "a member"} from the group`;

    const sysMsg = await db.chatMessage.create({
      data: {
        groupId,
        senderId: user.id,
        content: actionText,
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

    await broadcastFeedEvent(groupId, "new-chat-message", sysMsg);

    return NextResponse.json({
      success: true,
      message: actionText,
      removedUserId: targetUserId,
    });
  } catch (error) {
    console.error("Group member DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}

// PATCH /api/groups/[id]/members - Promote or demote group admins
export async function PATCH(
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
    const { userId, role } = body;

    if (!userId || !role || !["ADMIN", "MEMBER"].includes(role)) {
      return NextResponse.json(
        { error: "Valid userId and role ('ADMIN' | 'MEMBER') are required" },
        { status: 400 }
      );
    }

    const group = await db.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const callerMember = group.members.find((m) => m.userId === user.id);
    const isCallerAdmin = group.createdById === user.id || callerMember?.role === "ADMIN";

    if (!isCallerAdmin) {
      return NextResponse.json(
        { error: "Only group admins can change participant roles" },
        { status: 403 }
      );
    }

    const targetMember = group.members.find((m) => m.userId === userId);
    if (!targetMember) {
      return NextResponse.json({ error: "User is not a member of this group" }, { status: 404 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await db.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      data: { role },
    });

    const isPromoting = role === "ADMIN";
    const statusText = isPromoting
      ? `${user.name} made ${targetUser?.name || "a member"} a group admin 👑`
      : `${user.name} dismissed ${targetUser?.name || "a member"} as admin`;

    const sysMsg = await db.chatMessage.create({
      data: {
        groupId,
        senderId: user.id,
        content: statusText,
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

    await broadcastFeedEvent(groupId, "new-chat-message", sysMsg);

    return NextResponse.json({
      success: true,
      message: statusText,
      userId,
      role,
    });
  } catch (error) {
    console.error("Group member PATCH error:", error);
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
  }
}
