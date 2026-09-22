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

    const events = await db.communityEvent.findMany({
      where: { communityId },
      include: {
        rsvps: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error("Fetch events error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch events" }, { status: 500 });
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

    // Check if this is an RSVP action
    if (body.action === "rsvp") {
      const { eventId, status } = body;
      if (!eventId || !status) {
        return NextResponse.json({ error: "Missing eventId or status" }, { status: 400 });
      }

      const rsvp = await db.communityEventRsvp.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId: user.id,
          },
        },
        create: {
          eventId,
          userId: user.id,
          status,
        },
        update: {
          status,
        },
      });

      return NextResponse.json({ rsvp });
    }

    // Otherwise it's event creation
    const { title, description, location, startDate, endDate } = body;

    if (!title?.trim() || !startDate) {
      return NextResponse.json({ error: "Title and startDate are required" }, { status: 400 });
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

    if (!can(member, "CREATE_EVENTS", community)) {
      return NextResponse.json({ error: "You lack permission to create events" }, { status: 403 });
    }

    const event = await db.communityEvent.create({
      data: {
        communityId,
        creatorId: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error: any) {
    console.error("Event operation error:", error);
    return NextResponse.json({ error: error.message || "Failed to process event" }, { status: 500 });
  }
}
