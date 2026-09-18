import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/groups/[id]/messages - Fetch group details, members, and chat messages
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
        institution: { select: { name: true } },
        members: {
          include: {
            user: {
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
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Auto-join if same institution or batch
    const isMember = group.members.some((m) => m.userId === user.id);
    if (!isMember) {
      await db.groupMember.create({
        data: {
          groupId,
          userId: user.id,
          role: "MEMBER",
        },
      });
    }

    const messages = await db.chatMessage.findMany({
      where: { groupId },
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
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const parsedMessages = messages.map((m) => {
      let meta = null;
      try {
        if (m.metadata) meta = JSON.parse(m.metadata);
      } catch {
        meta = m.metadata;
      }
      return {
        ...m,
        metadata: meta,
      };
    });

    return NextResponse.json({
      currentUser: {
        id: user.id,
        name: user.name,
      },
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        scope: group.scope,
        batchYear: group.batchYear,
        institutionName: group.institution.name,
        memberCount: group.members.length,
        members: group.members.map((m) => m.user),
      },
      messages: parsedMessages,
    });
  } catch (error) {
    console.error("Messages GET error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

// POST /api/groups/[id]/messages - Send a message or share a music track
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
    const { content, type = "TEXT", metadata } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const message = await db.chatMessage.create({
      data: {
        groupId,
        senderId: user.id,
        content: content.trim(),
        type,
        metadata: metadata ? JSON.stringify(metadata) : null,
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

    let meta = null;
    try {
      if (message.metadata) meta = JSON.parse(message.metadata);
    } catch {
      meta = message.metadata;
    }

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        metadata: meta,
      },
    });
  } catch (error) {
    console.error("Messages POST error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
