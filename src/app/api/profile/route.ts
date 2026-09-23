import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createSessionToken, AUTH_COOKIE } from "@/lib/auth";
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
    let targetInst = null;
    if (institutionId) {
      targetInst = await db.institution.findUnique({ where: { id: institutionId } });
    }

    if (!targetInst && institutionName && typeof institutionName === "string" && institutionName.trim()) {
      const trimmedName = institutionName.trim();
      const allInsts = await db.institution.findMany({ take: 200 });
      targetInst =
        allInsts.find(
          (i) =>
            i.name.toLowerCase() === trimmedName.toLowerCase() ||
            (institutionId && i.id.toLowerCase() === institutionId.toLowerCase()) ||
            (institutionId && i.slug.toLowerCase() === institutionId.toLowerCase())
        ) || null;

      if (!targetInst) {
        const slugBase = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        targetInst = await db.institution.create({
          data: {
            name: trimmedName,
            slug: `${slugBase || "inst"}-${Date.now().toString(36)}`,
            type: institutionType || "COLLEGE",
          },
        });
      }
    }

    if (targetInst) {
      dataToUpdate.institutionId = targetInst.id;
    }

    if (course !== undefined) {
      dataToUpdate.course = typeof course === "string" && course.trim() ? course.trim() : null;
    }

    const effectiveInstId = dataToUpdate.institutionId || user.institutionId;

    // Always ensure valid batch for effectiveInstId
    const effectiveBatchYear =
      batchYear && !isNaN(Number(batchYear))
        ? parseInt(String(batchYear), 10)
        : user.batchYear || new Date().getFullYear();

    dataToUpdate.batchYear = effectiveBatchYear;

    let batch = await db.batch.findUnique({
      where: {
        institutionId_year: {
          institutionId: effectiveInstId,
          year: effectiveBatchYear,
        },
      },
    });

    if (!batch) {
      batch = await db.batch.create({
        data: {
          institutionId: effectiveInstId,
          year: effectiveBatchYear,
          estimatedSize: 60,
        },
      });
    }
    dataToUpdate.batchId = batch.id;

    // Handle department
    if (departmentName !== undefined) {
      if (departmentName && typeof departmentName === "string" && departmentName.trim()) {
        const trimmedDept = departmentName.trim();
        const existingDepts = await db.department.findMany({
          where: { institutionId: effectiveInstId },
        });
        let dept = existingDepts.find(
          (d) => d.name.toLowerCase() === trimmedDept.toLowerCase()
        );
        if (!dept) {
          dept = await db.department.create({
            data: {
              institutionId: effectiveInstId,
              name: trimmedDept,
            },
          });
        }
        dataToUpdate.departmentId = dept.id;
      } else {
        dataToUpdate.departmentId = null;
      }
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
    let newSessionToken: string | null = null;
    try {
      const safeAvatar =
        updatedUser.avatarUrl && updatedUser.avatarUrl.startsWith("http") && updatedUser.avatarUrl.length < 300
          ? updatedUser.avatarUrl
          : null;
      const safeCover =
        updatedUser.coverUrl && updatedUser.coverUrl.startsWith("http") && updatedUser.coverUrl.length < 300
          ? updatedUser.coverUrl
          : null;

      newSessionToken = await createSessionToken({
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
      cookieStore.set(AUTH_COOKIE.name, newSessionToken, AUTH_COOKIE.options);
      cookieStore.set("session_token", newSessionToken, AUTH_COOKIE.options);
    } catch (e) {
      console.warn("Could not refresh session cookie:", e);
    }

    const response = NextResponse.json({ success: true, user: updatedUser });
    if (newSessionToken) {
      response.cookies.set(AUTH_COOKIE.name, newSessionToken, AUTH_COOKIE.options);
      response.cookies.set("session_token", newSessionToken, AUTH_COOKIE.options);
    }
    return response;
  } catch (error: any) {
    console.error("PUT /api/profile error:", error);
    return NextResponse.json({ error: error.message || "Failed to update profile" }, { status: 500 });
  }
}
