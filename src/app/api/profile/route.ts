import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      avatarUrl,
      coverUrl,
      bio,
      currentCompany,
      currentRole,
      city,
      linkedinUrl,
      isPhoneVisible,
    } = body;

    const dataToUpdate: any = {};
    if (typeof name === "string" && name.trim()) dataToUpdate.name = name.trim();
    if (typeof avatarUrl === "string" || avatarUrl === null) dataToUpdate.avatarUrl = avatarUrl;
    if (typeof coverUrl === "string" || coverUrl === null) dataToUpdate.coverUrl = coverUrl;
    if (typeof bio === "string" || bio === null) dataToUpdate.bio = bio;
    if (typeof currentCompany === "string" || currentCompany === null) dataToUpdate.currentCompany = currentCompany;
    if (typeof currentRole === "string" || currentRole === null) dataToUpdate.currentRole = currentRole;
    if (typeof city === "string" || city === null) dataToUpdate.city = city;
    if (typeof linkedinUrl === "string" || linkedinUrl === null) dataToUpdate.linkedinUrl = linkedinUrl;
    if (typeof isPhoneVisible === "boolean") dataToUpdate.isPhoneVisible = isPhoneVisible;

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: dataToUpdate,
      include: {
        institution: true,
        department: true,
        batch: true,
      },
    });

    // Refresh the session cookie with updated fields
    try {
      const newSessionToken = await createSessionToken({
        userId: updatedUser.id,
        phone: updatedUser.phone,
        email: updatedUser.email,
        username: updatedUser.username,
        name: updatedUser.name,
        role: updatedUser.role,
        verificationStatus: updatedUser.verificationStatus,
        institutionId: updatedUser.institutionId,
        institutionName: updatedUser.institution?.name,
        batchYear: updatedUser.batchYear,
        departmentName: updatedUser.department?.name,
        currentCompany: updatedUser.currentCompany,
        currentRole: updatedUser.currentRole,
        city: updatedUser.city,
        avatarUrl: updatedUser.avatarUrl,
        coverUrl: updatedUser.coverUrl,
      });

      const cookieStore = await cookies();
      cookieStore.set("alumni_session", newSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    } catch (e) {
      console.warn("Could not refresh session cookie:", e);
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("PUT /api/profile error:", error);
    return NextResponse.json({ error: error.message || "Failed to update profile" }, { status: 500 });
  }
}
