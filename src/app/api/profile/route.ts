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
      institutionId,
      institutionName,
      institutionType,
      course,
      departmentName,
      batchYear,
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

    // Institution selection (discovery attribute - no verification roadblock)
    if (institutionId) {
      let inst = await db.institution.findUnique({ where: { id: institutionId } });
      if (!inst && institutionName) {
        inst = await db.institution.findFirst({ where: { name: institutionName.trim() } });
        if (!inst) {
          inst = await db.institution.create({
            data: {
              name: institutionName.trim(),
              slug: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              type: institutionType || "COLLEGE",
            },
          });
        }
      }
      if (inst) {
        dataToUpdate.institutionId = inst.id;
      }
    } else if (institutionName && typeof institutionName === "string" && institutionName.trim()) {
      let inst = await db.institution.findFirst({ where: { name: institutionName.trim() } });
      if (!inst) {
        inst = await db.institution.create({
          data: {
            name: institutionName.trim(),
            slug: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: institutionType || "COLLEGE",
          },
        });
      }
      dataToUpdate.institutionId = inst.id;
    }

    if (course !== undefined) {
      dataToUpdate.course = typeof course === "string" ? course.trim() : null;
    }

    const effectiveInstId = dataToUpdate.institutionId || user.institutionId;

    if (batchYear && !isNaN(Number(batchYear))) {
      const yearInt = parseInt(String(batchYear), 10);
      dataToUpdate.batchYear = yearInt;
      let batch = await db.batch.findUnique({
        where: {
          institutionId_year: {
            institutionId: effectiveInstId,
            year: yearInt,
          },
        },
      });
      if (!batch) {
        batch = await db.batch.create({
          data: {
            institutionId: effectiveInstId,
            year: yearInt,
            estimatedSize: 60,
          },
        });
      }
      dataToUpdate.batchId = batch.id;
    }

    if (departmentName && typeof departmentName === "string" && departmentName.trim()) {
      let dept = await db.department.findUnique({
        where: {
          institutionId_name: {
            institutionId: effectiveInstId,
            name: departmentName.trim(),
          },
        },
      });
      if (!dept) {
        dept = await db.department.create({
          data: {
            institutionId: effectiveInstId,
            name: departmentName.trim(),
          },
        });
      }
      dataToUpdate.departmentId = dept.id;
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: dataToUpdate,
      include: {
        institution: true,
        department: true,
        batch: true,
      },
    });

    // Refresh the session cookie with updated fields (strictly keeping cookie < 1KB)
    try {
      const safeAvatar =
        updatedUser.avatarUrl && updatedUser.avatarUrl.startsWith("http") && updatedUser.avatarUrl.length < 300
          ? updatedUser.avatarUrl
          : null;
      const safeCover =
        updatedUser.coverUrl && updatedUser.coverUrl.startsWith("http") && updatedUser.coverUrl.length < 300
          ? updatedUser.coverUrl
          : null;

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
        course: updatedUser.course,
        currentCompany: updatedUser.currentCompany,
        currentRole: updatedUser.currentRole,
        city: updatedUser.city,
        avatarUrl: safeAvatar,
        coverUrl: safeCover,
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
