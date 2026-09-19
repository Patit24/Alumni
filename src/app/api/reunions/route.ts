import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/reunions - List reunions & buddy get-togethers
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "ALL"; // "ALL", "BATCH", "UPCOMING"

    const where: Prisma.EventWhereInput = {
      institutionId: user.institutionId,
    };

    if (scope === "BATCH") {
      where.batchScope = { in: ["ALL", String(user.batchYear)] };
    }

    const events = await db.event.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            batchYear: true,
            currentRole: true,
            currentCompany: true,
            verificationStatus: true,
          },
        },
        rsvps: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                batchYear: true,
                currentRole: true,
                currentCompany: true,
              },
            },
          },
        },
      },
      orderBy: { date: "asc" },
    });

    const formatted = events.map((e) => {
      const userRsvp = e.rsvps.find((r) => r.userId === user.id);
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date,
        location: e.location,
        batchScope: e.batchScope,
        creator: e.creator,
        attendeeCount: e.rsvps.length,
        attendees: e.rsvps.map((r) => r.user),
        isRsvpd: userRsvp?.status === "CONFIRMED",
        isCreator: e.creatorId === user.id,
      };
    });

    return NextResponse.json({
      currentUser: {
        id: user.id,
        name: user.name,
        batchYear: user.batchYear,
        institutionName: user.institution.name,
        verificationStatus: user.verificationStatus,
      },
      reunions: formatted,
    });
  } catch (error) {
    console.error("Reunions GET error:", error);
    return NextResponse.json({ error: "Failed to fetch reunions" }, { status: 500 });
  }
}

// POST /api/reunions - Plan a new reunion OR toggle RSVP
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // Action A: Toggle RSVP
    if (action === "TOGGLE_RSVP") {
      const { eventId } = body;
      if (!eventId) {
        return NextResponse.json({ error: "Event ID required" }, { status: 400 });
      }

      const existingRsvp = await db.eventRsvp.findUnique({
        where: {
          eventId_userId: { eventId, userId: user.id },
        },
      });

      if (existingRsvp && existingRsvp.status === "CONFIRMED") {
        await db.eventRsvp.delete({
          where: {
            eventId_userId: { eventId, userId: user.id },
          },
        });
        return NextResponse.json({
          success: true,
          rsvpd: false,
          message: "You have cancelled your RSVP.",
        });
      } else {
        await db.eventRsvp.upsert({
          where: {
            eventId_userId: { eventId, userId: user.id },
          },
          create: {
            eventId,
            userId: user.id,
            status: "CONFIRMED",
          },
          update: {
            status: "CONFIRMED",
          },
        });
        return NextResponse.json({
          success: true,
          rsvpd: true,
          message: "RSVP confirmed! See you there with batchmates! 🎉",
        });
      }
    }

    // Action B: Plan a new Reunion
    const { title, description, date, location, batchScope } = body;

    if (!title || !description || !date || !location) {
      return NextResponse.json(
        { error: "Title, description, date, and location are required." },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
    }

    const event = await db.event.create({
      data: {
        institutionId: user.institutionId,
        creatorId: user.id,
        title: title.trim(),
        description: description.trim(),
        date: parsedDate,
        location: location.trim(),
        batchScope: batchScope || "ALL",
        rsvps: {
          create: {
            userId: user.id,
            status: "CONFIRMED",
          },
        },
      },
    });

    // Also share a notice into the campus feed!
    await db.feedItem.create({
      data: {
        institutionId: user.institutionId,
        actorId: user.id,
        type: "EVENT_CREATED",
        metadata: JSON.stringify({
          text: `🎉 New Reunion Planned: "${event.title}" on ${parsedDate.toLocaleDateString()} at ${event.location}! Come join your batchmates!`,
          badge: "Reunion Alert",
          likes: 5,
          commentsCount: 2,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Reunion plan created successfully! Added to your network feed.",
      event,
    });
  } catch (error) {
    console.error("Reunions POST error:", error);
    return NextResponse.json({ error: "Failed to create reunion" }, { status: 500 });
  }
}
