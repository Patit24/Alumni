import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/feed - Fetch LinkedIn-style posts
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "ALL"; // "ALL", "JOBS", "MENTORSHIP", "BATCH"

    const where: Prisma.FeedItemWhereInput = {
      institutionId: user.institutionId,
    };

    if (filter === "JOBS") {
      where.type = "JOB_POSTED";
    } else if (filter === "MENTORSHIP") {
      where.type = "MENTORSHIP_AVAILABLE";
    } else if (filter === "BATCH") {
      where.actor = {
        batchYear: user.batchYear,
      };
    }

    const items = await db.feedItem.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            currentRole: true,
            currentCompany: true,
            batchYear: true,
            verificationStatus: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const parsedItems = items.map((item) => {
      let meta = {};
      try {
        if (item.metadata) meta = JSON.parse(item.metadata);
      } catch {
        meta = { text: item.metadata };
      }
      return {
        ...item,
        metadata: meta,
      };
    });

    return NextResponse.json({
      currentUser: {
        id: user.id,
        name: user.name,
        verificationStatus: user.verificationStatus,
        batchYear: user.batchYear,
        institutionName: user.institution.name,
      },
      feed: parsedItems,
    });
  } catch (error) {
    console.error("Feed GET error:", error);
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}

// POST /api/feed - Share an update / post on the feed
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { text, type = "POST" } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Post text is required" }, { status: 400 });
    }

    const feedItem = await db.feedItem.create({
      data: {
        institutionId: user.institutionId,
        actorId: user.id,
        type,
        metadata: JSON.stringify({
          text: text.trim(),
          likes: 0,
          commentsCount: 0,
          badge: type === "POST" ? "Alumni Update" : type,
        }),
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            currentRole: true,
            currentCompany: true,
            batchYear: true,
            verificationStatus: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    let meta = {};
    try {
      meta = JSON.parse(feedItem.metadata || "{}");
    } catch {
      meta = { text: feedItem.metadata };
    }

    return NextResponse.json({
      success: true,
      feedItem: {
        ...feedItem,
        metadata: meta,
      },
    });
  } catch (error) {
    console.error("Feed POST error:", error);
    return NextResponse.json({ error: "Failed to publish post" }, { status: 500 });
  }
}
