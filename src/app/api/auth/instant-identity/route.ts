import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function generateCleanUsername(rawName: string, batchYear: number): string {
  const base = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanBase = base || "alumni";
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${cleanBase}_${randomSuffix}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      username: requestedUsername,
      institutionId,
      institutionName,
      batchYear = new Date().getFullYear(),
      departmentName,
      currentRole,
      currentCompany,
      city,
      publicKey,
      deviceId,
    } = body;

    const displayName = (name || "").trim() || "Anonymous Alumni";
    const year = parseInt(String(batchYear), 10) || new Date().getFullYear();
    const targetInstName = (institutionName || body.customInstitutionName || "").trim();
    const customInstType = body.customInstitutionType || "COLLEGE";

    // 1. Resolve Institution cleanly (by id, by name, or by slug)
    let institution = null;
    if (institutionId) {
      institution = await db.institution.findUnique({
        where: { id: institutionId },
        include: { departments: true },
      });
    }

    if (!institution && targetInstName) {
      // Find case-insensitively across existing institutions
      const allInsts = await db.institution.findMany({
        take: 200,
        include: { departments: true },
      });
      institution =
        allInsts.find(
          (i) =>
            i.name.toLowerCase() === targetInstName.toLowerCase() ||
            (institutionId && i.id.toLowerCase() === institutionId.toLowerCase()) ||
            (institutionId && i.slug.toLowerCase() === institutionId.toLowerCase())
        ) || null;

      if (!institution) {
        const slugBase = targetInstName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        institution = await db.institution.create({
          data: {
            name: targetInstName,
            slug: `${slugBase || "inst"}-${Math.random().toString(36).substring(2, 6)}`,
            type: customInstType,
            country: "India",
          },
          include: { departments: true },
        });
      }
    }

    if (!institution) {
      return NextResponse.json(
        { error: "Please select or type your college, university, or school name." },
        { status: 400 }
      );
    }

    // 2. Resolve Department
    let departmentId = null;
    if (departmentName && departmentName.trim()) {
      const trimmedDept = departmentName.trim();
      const existingDepts = await db.department.findMany({
        where: { institutionId: institution.id },
      });
      let dept = existingDepts.find(
        (d: { name: string }) => d.name.toLowerCase() === trimmedDept.toLowerCase()
      );
      if (!dept) {
        dept = await db.department.create({
          data: { name: trimmedDept, institutionId: institution.id },
        });
      }
      departmentId = dept.id;
    }

    // 3. Resolve Batch
    let batch = await db.batch.findUnique({
      where: {
        institutionId_year: {
          institutionId: institution.id,
          year,
        },
      },
    });

    if (!batch) {
      batch = await db.batch.create({
        data: {
          institutionId: institution.id,
          year,
        },
      });
    }

    // 4. Generate unique @username
    let finalUsername = requestedUsername
      ? requestedUsername.toLowerCase().replace(/[^a-z0-9_]/g, "")
      : "";

    if (!finalUsername) {
      finalUsername = generateCleanUsername(displayName, year);
    }

    // Verify uniqueness of username
    let userWithUsername = await db.user.findUnique({
      where: { username: finalUsername },
    });
    let attempts = 0;
    while (userWithUsername && attempts < 5) {
      finalUsername = generateCleanUsername(displayName, year);
      userWithUsername = await db.user.findUnique({
        where: { username: finalUsername },
      });
      attempts++;
    }

    // 5. Create user record with NO phone number and NO email required
    const user = await db.user.create({
      data: {
        name: displayName,
        username: finalUsername,
        role: "USER",
        verificationStatus: "VERIFIED",
        institutionId: institution.id,
        batchId: batch.id,
        batchYear: year,
        departmentId,
        city: city?.trim() || null,
      },
      include: {
        institution: { select: { id: true, name: true } },
        batch: { select: { id: true, year: true } },
        department: { select: { id: true, name: true } },
      },
    });

    // 6. Register cryptographic device public key if provided
    if (publicKey && deviceId) {
      await db.userDevice.upsert({
        where: { deviceId },
        update: {
          userId: user.id,
          publicKey,
          lastActiveAt: new Date(),
        },
        create: {
          userId: user.id,
          deviceId,
          deviceName: "Primary Device",
          publicKey,
        },
      });
    }

    // 7. Issue session token JWT cookie
    const token = await createSessionToken({
      userId: user.id,
      phone: null,
      email: null,
      username: user.username,
      name: user.name,
      role: user.role,
      verificationStatus: user.verificationStatus,
      institutionId: user.institutionId,
      institutionName: user.institution.name,
      batchYear: user.batchYear,
    });

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE.name, token, AUTH_COOKIE.options);
    cookieStore.set("session_token", token, AUTH_COOKIE.options);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        institutionId: user.institutionId,
        institutionName: user.institution.name,
        batchYear: user.batchYear,
      },
    });
  } catch (error: any) {
    console.error("Instant identity creation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create identity" },
      { status: 500 }
    );
  }
}
