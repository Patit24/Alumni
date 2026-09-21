import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/privacy/report - Report a user for abuse or spam
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targetUserId, reason } = await req.json();
    if (!targetUserId || !reason) {
      return NextResponse.json({ error: "targetUserId and reason are required" }, { status: 400 });
    }

    const report = await db.userReport.create({
      data: {
        reporterId: user.id,
        reportedId: targetUserId,
        reason: reason.trim().slice(0, 1000),
      },
    });

    return NextResponse.json({ success: true, reportId: report.id });
  } catch (error) {
    console.error("Error in /api/privacy/report POST:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
