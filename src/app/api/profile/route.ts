import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const user = await getCurrentUser(bearerToken);
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
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const user = await getCurrentUser(bearerToken);
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
    if (course !== undefined) {
      dataToUpdate.course = typeof course === "string" && course.trim() ? course.trim() : null;
    }

    // Only update institution if explicitly sent in body
    let targetInstId = institutionId;
    if (!targetInstId && institutionName && typeof institutionName === "string" && institutionName.trim()) {
      const trimmedName = institutionName.trim();
      const allInsts = await db.institution.findMany({ take: 200 });
      let matched = allInsts.find(
        (i) => i.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (!matched) {
        const slugBase = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        matched = await db.institution.create({
          data: {
            name: trimmedName,
            slug: `${slugBase || "inst"}-${Date.now().toString(36)}`,
            type: institutionType || "COLLEGE",
          },
        });
      }
      targetInstId = matched.id;
    }

    if (targetInstId) {
      dataToUpdate.institutionId = targetInstId;
    }

    // Only update batch if batchYear or institution was explicitly sent
    if (batchYear !== undefined || targetInstId !== undefined) {
      const effectiveInstId = targetInstId || user.institutionId;
      const effectiveBatchYear =
        batchYear && !isNaN(Number(batchYear))
          ? parseInt(String(batchYear), 10)
          : user.batchYear || new Date().getFullYear();

      dataToUpdate.batchYear = effectiveBatchYear;

      try {
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
      } catch (batchErr) {
        console.warn("Batch resolution notice:", batchErr);
      }
    }

    // Only update department if explicitly sent
    if (departmentName !== undefined) {
      const effectiveInstId = targetInstId || user.institutionId;
      if (departmentName && typeof departmentName === "string" && departmentName.trim()) {
        const trimmedDept = departmentName.trim();
        try {
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
        } catch (deptErr) {
          console.warn("Department resolution notice:", deptErr);
        }
      } else {
        dataToUpdate.departmentId = null;
      }
    }

    // Locate target user in local SQLite DB by id or email
    let targetDbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!targetDbUser && user.email) {
      targetDbUser = await db.user.findFirst({
        where: {
          OR: [{ email: user.email }, { email: user.email.toLowerCase() }],
        },
      });
    }

    let updatedUser: any;
    if (targetDbUser) {
      updatedUser = await db.user.update({
        where: { id: targetDbUser.id },
        data: dataToUpdate,
        include: {
          institution: true,
          department: true,
          batch: true,
        },
      });
    } else {
      // Re-create user record in this container if it was missing from local SQLite
      const targetEmail = user.email ? user.email.toLowerCase().trim() : null;
      let inst = await db.institution.findFirst();
      if (!inst) {
        inst = await db.institution.create({
          data: { name: "Campus Network", slug: "campus-network", type: "COLLEGE" },
        });
      }
      let batch = await db.batch.findFirst({ where: { institutionId: inst.id } });
      if (!batch) {
        batch = await db.batch.create({
          data: { institutionId: inst.id, year: 2026, estimatedSize: 60 },
        });
      }

      updatedUser = await db.user.create({
        data: {
          id: user.id,
          email: targetEmail,
          name: dataToUpdate.name || user.name || "Alumni Member",
          avatarUrl: dataToUpdate.avatarUrl !== undefined ? dataToUpdate.avatarUrl : user.avatarUrl,
          coverUrl: dataToUpdate.coverUrl !== undefined ? dataToUpdate.coverUrl : user.coverUrl,
          institutionId: dataToUpdate.institutionId || inst.id,
          batchId: dataToUpdate.batchId || batch.id,
          batchYear: dataToUpdate.batchYear || 2026,
          city: dataToUpdate.city !== undefined ? dataToUpdate.city : user.city,
          currentCompany: dataToUpdate.currentCompany !== undefined ? dataToUpdate.currentCompany : user.currentCompany,
          currentRole: dataToUpdate.currentRole !== undefined ? dataToUpdate.currentRole : user.currentRole,
        },
        include: {
          institution: true,
          department: true,
          batch: true,
        },
      });
    }

    // Refresh the session cookie with updated fields
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

    const response = NextResponse.json({
      success: true,
      user: updatedUser,
      token: newSessionToken,
    });
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
