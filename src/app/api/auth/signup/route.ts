import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "alumni-network-super-secret-jwt-key-minimum-32-characters"
);

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      signupToken,
      name,
      institutionId,
      newInstitutionName,
      newInstitutionType,
      batchYear,
      departmentName,
      currentCompany,
      currentRole,
      city,
      linkedinUrl,
    } = body;

    if (!signupToken || !name || !batchYear) {
      return NextResponse.json(
        { error: "Signup token, name, and batch year are required" },
        { status: 400 }
      );
    }

    // Verify signup token
    let verifiedPhone: string;
    try {
      const { payload } = await jwtVerify(signupToken, JWT_SECRET);
      if (payload.purpose !== "signup" || !payload.phone) {
        return NextResponse.json({ error: "Invalid signup token" }, { status: 400 });
      }
      verifiedPhone = payload.phone as string;
    } catch {
      return NextResponse.json({ error: "Expired or invalid signup token" }, { status: 400 });
    }

    // Double check user doesn't already exist
    const existing = await db.user.findUnique({
      where: { phone: verifiedPhone },
    });
    if (existing) {
      return NextResponse.json({ error: "User with this phone already exists" }, { status: 400 });
    }

    // 1. Resolve Institution
    let resolvedInstId = institutionId;
    let isFoundingMember = false;

    if (!resolvedInstId && newInstitutionName) {
      const slugBase = slugify(newInstitutionName);
      const uniqueSlug = `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newInst = await db.institution.create({
        data: {
          name: newInstitutionName.trim(),
          slug: uniqueSlug,
          type: newInstitutionType || "COLLEGE",
          city: city || null,
        },
      });
      resolvedInstId = newInst.id;
      isFoundingMember = true;
    }

    if (!resolvedInstId) {
      return NextResponse.json(
        { error: "Please select an existing institution or enter a new one" },
        { status: 400 }
      );
    }

    // 2. Resolve Batch
    const yearInt = parseInt(batchYear.toString(), 10);
    if (isNaN(yearInt) || yearInt < 1950 || yearInt > 2035) {
      return NextResponse.json({ error: "Please provide a valid graduation year" }, { status: 400 });
    }

    let batch = await db.batch.findUnique({
      where: {
        institutionId_year: {
          institutionId: resolvedInstId,
          year: yearInt,
        },
      },
    });

    if (!batch) {
      batch = await db.batch.create({
        data: {
          institutionId: resolvedInstId,
          year: yearInt,
          estimatedSize: 60,
        },
      });
    }

    // 3. Resolve Department (optional)
    let resolvedDeptId: string | null = null;
    if (departmentName && departmentName.trim()) {
      const cleanDept = departmentName.trim();
      let dept = await db.department.findUnique({
        where: {
          institutionId_name: {
            institutionId: resolvedInstId,
            name: cleanDept,
          },
        },
      });

      if (!dept) {
        dept = await db.department.create({
          data: {
            institutionId: resolvedInstId,
            name: cleanDept,
          },
        });
      }
      resolvedDeptId = dept.id;
    }

    // 4. Create User (marked UNVERIFIED)
    const newUser = await db.user.create({
      data: {
        phone: verifiedPhone,
        name: name.trim(),
        role: isFoundingMember ? "INSTITUTION_ADMIN" : "USER",
        verificationStatus: "UNVERIFIED",
        institutionId: resolvedInstId,
        departmentId: resolvedDeptId,
        batchId: batch.id,
        batchYear: yearInt,
        currentCompany: currentCompany?.trim() || null,
        currentRole: currentRole?.trim() || null,
        city: city?.trim() || null,
        linkedinUrl: linkedinUrl?.trim() || null,
      },
      include: {
        institution: true,
        department: true,
        batch: true,
      },
    });

    // If founding member, set on institution
    if (isFoundingMember) {
      await db.institution.update({
        where: { id: resolvedInstId },
        data: { foundingMemberId: newUser.id },
      });
    }

    // 5. Generate feed item for joining (Phase 4 engine)
    await db.feedItem.create({
      data: {
        institutionId: resolvedInstId,
        actorId: newUser.id,
        type: "USER_JOINED",
        metadata: JSON.stringify({
          userName: newUser.name,
          batchYear: newUser.batchYear,
          department: newUser.department?.name,
        }),
      },
    });

    // 6. Set Session Cookie
    const sessionToken = await createSessionToken({
      userId: newUser.id,
      phone: newUser.phone,
    });

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);

    return NextResponse.json({
      success: true,
      user: newUser,
    });
  } catch (error) {
    console.error("signup error:", (error as Error)?.stack || error);
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to complete signup" },
      { status: 500 }
    );
  }
}
