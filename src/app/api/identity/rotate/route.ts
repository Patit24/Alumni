import { NextResponse } from "next/server";
import { getCurrentUser, createSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { requestedUsername } = body;

    const oldUsername = user.username;

    // Rate limiting: check if rotated in the last 60 seconds
    if (oldUsername) {
      const recentRotation = await db.rotatedUsername.findFirst({
        where: {
          userId: user.id,
          rotatedAt: { gte: new Date(Date.now() - 60 * 1000) },
        },
      });
      if (recentRotation) {
        return NextResponse.json(
          { error: "Identity rotation is limited to once every 60 seconds." },
          { status: 429 }
        );
      }
    }

    // Determine new username
    let newUsername = requestedUsername
      ? requestedUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 25)
      : "";

    if (!newUsername || newUsername.length < 3) {
      const base = (user.name || "alumni").toLowerCase().replace(/[^a-z0-9]/g, "") || "alumni";
      const rand = Math.random().toString(36).substring(2, 6);
      newUsername = `${base}_${rand}`;
    }

    // Check if new username is currently taken by an active user
    const existingUser = await db.user.findUnique({
      where: { username: newUsername },
    });
    if (existingUser && existingUser.id !== user.id) {
      return NextResponse.json(
        { error: `The handle @${newUsername} is already taken. Please choose another.` },
        { status: 400 }
      );
    }

    // Check if retired in RotatedUsername
    const retired = await db.rotatedUsername.findUnique({
      where: { username: newUsername },
    });
    if (retired && retired.userId !== user.id) {
      return NextResponse.json(
        { error: `The handle @${newUsername} was previously retired by another alumnus.` },
        { status: 400 }
      );
    }

    // Record old username in RotatedUsername archive
    if (oldUsername && oldUsername !== newUsername) {
      await db.rotatedUsername.upsert({
        where: { username: oldUsername },
        update: { rotatedAt: new Date() },
        create: {
          userId: user.id,
          username: oldUsername,
          rotatedAt: new Date(),
        },
      });
    }

    // Update active user record
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { username: newUsername },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        institutionId: true,
        batchYear: true,
      },
    });

    // Re-issue updated session cookie
    const token = await createSessionToken({
      userId: updatedUser.id,
      phone: user.phone || null,
      email: user.email || null,
      username: updatedUser.username,
      role: updatedUser.role,
      institutionId: updatedUser.institutionId,
      batchYear: updatedUser.batchYear,
    });

    const cookieStore = await cookies();
    cookieStore.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      oldUsername,
      newUsername: updatedUser.username,
      message: `Identity rotated to @${updatedUser.username}. Old handle retired. Existing encrypted device sessions preserved.`,
    });
  } catch (error: any) {
    console.error("Identity rotation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to rotate identity" },
      { status: 500 }
    );
  }
}
