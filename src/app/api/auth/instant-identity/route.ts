import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
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

    // 1. Resolve or default Institution
    let institution = null;
    if (institutionId) {
      institution = await db.institution.findUnique({
        where: { id: institutionId },
        include: { departments: true },
      });
    }

    if (!institution) {
      institution = await db.institution.findFirst({
        where: { name: "Brainware University" },
        include: { departments: true },
      });
    }

    if (!institution) {
      institution = await db.institution.create({
        data: {
          name: "Brainware University",
          slug: "brainware-university",
          type: "UNIVERSITY",
          country: "India",
          city: "Kolkata",
        },
        include: { departments: true },
      });
    }

    // 2. Resolve Department
    let departmentId = null;
    if (departmentName && departmentName.trim()) {
      const trimmedDept = departmentName.trim();
      let dept = institution.departments.find(
        (d) => d.name.toLowerCase() === trimmedDept.toLowerCase()
      );
      if (!dept) {
        dept = await db.department.create({
          data: {
            name: trimmedDept,
            institutionId: institution.id,
          },
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
        currentRole: currentRole?.trim() || null,
        currentCompany: currentCompany?.trim() || null,
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
      role: user.role,
      institutionId: user.institutionId,
      batchYear: user.batchYear,
    });

    const cookieStore = await cookies();
    cookieStore.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
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
