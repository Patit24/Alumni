import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastFeedEvent } from "@/lib/supabase-broadcast";

export const dynamic = "force-dynamic";

// PATCH /api/groups/[id]/security - Admin updates secret mode or screenshot permission
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
    const { isSecretMode, allowScreenshot } = body;

    const group = await db.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { userId: user.id },
          select: { role: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Verify Admin rights
    const isAdmin = group.createdById === user.id || group.members[0]?.role === "ADMIN";
    if (!isAdmin) {
      return NextResponse.json({ error: "Only group admins can change security settings" }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    const announcements: string[] = [];

    if (typeof isSecretMode === "boolean" && isSecretMode !== group.isSecretMode) {
      updateData.isSecretMode = isSecretMode;
      if (isSecretMode) {
        announcements.push(`🔒 ${user.name} enabled Secret Conversation Mode. Messages will automatically vanish after 48 hours, and non-members cannot track this group.`);
      } else {
        announcements.push(`🔓 ${user.name} turned off Secret Conversation Mode.`);
      }
    }

    if (typeof allowScreenshot === "boolean" && allowScreenshot !== group.allowScreenshot) {
      updateData.allowScreenshot = allowScreenshot;
      if (allowScreenshot) {
        announcements.push(`📸 ${user.name} (Admin) allowed members to take screenshots.`);
      } else {
        announcements.push(`🚫 ${user.name} (Admin) restricted screenshots. Screen capture is now blocked.`);
      }
    }

    const updatedGroup = await db.group.update({
      where: { id: groupId },
      data: updateData,
    });

    // Create system message announcements & broadcast live
    for (const ann of announcements) {
      const msg = await db.chatMessage.create({
        data: {
          groupId,
          senderId: user.id,
          content: ann,
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

      await broadcastFeedEvent(groupId, "new-chat-message", msg);
    }

    // Broadcast security settings update
    await broadcastFeedEvent(groupId, "group-security-update", {
      groupId,
      isSecretMode: updatedGroup.isSecretMode,
      allowScreenshot: updatedGroup.allowScreenshot,
    });

    return NextResponse.json({
      success: true,
      group: {
        isSecretMode: updatedGroup.isSecretMode,
        allowScreenshot: updatedGroup.allowScreenshot,
      },
    });
  } catch (error) {
    console.error("Group security PATCH error:", error);
    return NextResponse.json({ error: "Failed to update security settings" }, { status: 500 });
  }
}

// POST /api/groups/[id]/security - Report screenshot attempt & broadcast to group
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

    const group = await db.group.findUnique({
      where: { id: groupId },
      select: { id: true, allowScreenshot: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const alertContent = `🚨 SCREENSHOT ALERT: ${user.name} took or attempted a screenshot of this conversation!`;

    // Save warning announcement in chat history
    const sysMsg = await db.chatMessage.create({
      data: {
        groupId,
        senderId: user.id,
        content: alertContent,
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

    // Broadcast live to all members currently in the room
    await broadcastFeedEvent(groupId, "screenshot-alert", {
      groupId,
      culpritName: user.name,
      culpritId: user.id,
      timestamp: new Date().toISOString(),
    });

    await broadcastFeedEvent(groupId, "new-chat-message", sysMsg);

    return NextResponse.json({
      success: true,
      reported: true,
    });
  } catch (error) {
    console.error("Screenshot report POST error:", error);
    return NextResponse.json({ error: "Failed to log screenshot alert" }, { status: 500 });
  }
}
