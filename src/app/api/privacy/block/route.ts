import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/privacy/block - List blocked users
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blocked = await db.userBlock.findMany({
      where: { blockerId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const userIds = blocked.map((b) => b.blockedId);
    const blockedUsers = await db.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        batchYear: true,
        currentRole: true,
        currentCompany: true,
      },
    });

    return NextResponse.json({ success: true, blockedUsers });
  } catch (error) {
    console.error("Error in /api/privacy/block GET:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/privacy/block - Block a user
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId || targetUserId === user.id) {
      return NextResponse.json({ error: "Invalid targetUserId" }, { status: 400 });
    }

    await db.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: user.id,
          blockedId: targetUserId,
        },
      },
      update: {},
      create: {
        blockerId: user.id,
        blockedId: targetUserId,
      },
    });

    return NextResponse.json({ success: true, blockedUserId: targetUserId });
  } catch (error) {
    console.error("Error in /api/privacy/block POST:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/privacy/block - Unblock a user
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("targetUserId");
    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    await db.userBlock.deleteMany({
      where: {
        blockerId: user.id,
        blockedId: targetUserId,
      },
    });

    return NextResponse.json({ success: true, unblockedUserId: targetUserId });
  } catch (error) {
    console.error("Error in /api/privacy/block DELETE:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
