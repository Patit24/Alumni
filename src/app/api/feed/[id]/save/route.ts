import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: feedItemId } = await props.params;

    const feedItem = await db.feedItem.findUnique({
      where: { id: feedItemId },
      select: { id: true },
    });

    if (!feedItem) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const existingSave = await db.postSave.findUnique({
      where: {
        feedItemId_userId: {
          feedItemId,
          userId: user.id,
        },
      },
    });

    let saved = false;
    if (existingSave) {
      await db.postSave.delete({
        where: { id: existingSave.id },
      });
      saved = false;
    } else {
      await db.postSave.create({
        data: {
          feedItemId,
          userId: user.id,
        },
      });
      saved = true;
    }

    const savesCount = await db.postSave.count({
      where: { feedItemId },
    });

    return NextResponse.json({
      success: true,
      saved,
      savesCount,
    });
  } catch (error) {
    console.error("POST /api/feed/[id]/save error:", error);
    return NextResponse.json({ error: "Failed to toggle save" }, { status: 500 });
  }
}
