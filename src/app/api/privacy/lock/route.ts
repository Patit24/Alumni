import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/privacy/lock - Check current lock status
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await db.userPrivacySettings.findUnique({
      where: { userId: user.id },
      select: { privacyLockActive: true },
    });

    return NextResponse.json({
      success: true,
      privacyLockActive: settings?.privacyLockActive || false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to read privacy lock state" }, { status: 500 });
  }
}

// POST /api/privacy/lock - Toggle or set privacy lock
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let shouldActivate: boolean;

    if (typeof body.active === "boolean") {
      shouldActivate = body.active;
    } else {
      const current = await db.userPrivacySettings.findUnique({
        where: { userId: user.id },
        select: { privacyLockActive: true },
      });
      shouldActivate = !(current?.privacyLockActive || false);
    }

    const updated = await db.userPrivacySettings.upsert({
      where: { userId: user.id },
      update: { privacyLockActive: shouldActivate },
      create: {
        userId: user.id,
        privacyLockActive: shouldActivate,
      },
    });

    return NextResponse.json({
      success: true,
      privacyLockActive: updated.privacyLockActive,
      message: updated.privacyLockActive
        ? "🔒 Privacy Lock activated. Incoming calls blocked, presence paused, and ghost notifications enforced."
        : "🔓 Privacy Lock disabled. Standard privacy settings restored.",
    });
  } catch (error: any) {
    console.error("Privacy lock toggle error:", error);
    return NextResponse.json({ error: "Failed to toggle privacy lock" }, { status: 500 });
  }
}
