import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/privacy/settings - Get user's privacy preferences
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let settings = await db.userPrivacySettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings) {
      settings = await db.userPrivacySettings.create({
        data: {
          userId: user.id,
          readReceipts: true,
          typingIndicators: true,
          onlineStatus: true,
          lastSeen: false,
          allowCallsFrom: "EVERYONE",
          disappearingDefault: 0,
        },
      });
    }

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Error in /api/privacy/settings GET:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PUT /api/privacy/settings - Update user's privacy preferences
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      readReceipts,
      typingIndicators,
      onlineStatus,
      lastSeen,
      allowCallsFrom,
      disappearingDefault,
    } = body;

    const updated = await db.userPrivacySettings.upsert({
      where: { userId: user.id },
      update: {
        ...(typeof readReceipts === "boolean" ? { readReceipts } : {}),
        ...(typeof typingIndicators === "boolean" ? { typingIndicators } : {}),
        ...(typeof onlineStatus === "boolean" ? { onlineStatus } : {}),
        ...(typeof lastSeen === "boolean" ? { lastSeen } : {}),
        ...(allowCallsFrom ? { allowCallsFrom } : {}),
        ...(typeof disappearingDefault === "number" ? { disappearingDefault } : {}),
      },
      create: {
        userId: user.id,
        readReceipts: readReceipts ?? true,
        typingIndicators: typingIndicators ?? true,
        onlineStatus: onlineStatus ?? true,
        lastSeen: lastSeen ?? false,
        allowCallsFrom: allowCallsFrom || "EVERYONE",
        disappearingDefault: disappearingDefault || 0,
      },
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    console.error("Error in /api/privacy/settings PUT:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
