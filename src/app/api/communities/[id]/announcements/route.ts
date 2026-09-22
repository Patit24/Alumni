import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/communities/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: communityId } = await params;

    const member = await db.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId: user.id,
        },
      },
      include: {
        role: true,
      },
    });

    if (!member || member.status !== "ACTIVE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const announcements = await db.communityAnnouncement.findMany({
      where: { communityId },
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ announcements });
  } catch (error: any) {
    console.error("Fetch announcements error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch announcements" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: communityId } = await params;
    const body = await req.json();
    const { title, content, isPinned, notifyAll } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const community = await db.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    const member = await db.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId: user.id,
        },
      },
      include: {
        role: true,
      },
    });

    if (!member || member.status !== "ACTIVE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!can(member, "CREATE_ANNOUNCEMENTS", community)) {
      return NextResponse.json({ error: "You lack permission to post announcements" }, { status: 403 });
    }

    const announcement = await db.communityAnnouncement.create({
      data: {
        communityId,
        authorId: user.id,
        title: title.trim(),
        content: content.trim(),
        isPinned: !!isPinned,
        notifyAll: !!notifyAll,
      },
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error: any) {
    console.error("Create announcement error:", error);
    return NextResponse.json({ error: error.message || "Failed to create announcement" }, { status: 500 });
  }
}
