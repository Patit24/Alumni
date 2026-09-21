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
      email,
      phone,
      name,
      institutionId,
      institutionName,
      newInstitutionName,
      newInstitutionType,
      batchYear,
      departmentName,
      currentCompany,
      currentRole,
      city,
      linkedinUrl,
    } = body;

    if (!name || !batchYear) {
      return NextResponse.json(
        { error: "Name and batch year are required" },
        { status: 400 }
      );
    }

    // 1. Resolve verified email or phone number
    let verifiedEmail: string | null = null;
    let verifiedPhone: string | null = null;

    if (signupToken) {
      try {
        const { payload } = await jwtVerify(signupToken, JWT_SECRET);
        if (payload.email) {
          verifiedEmail = (payload.email as string).trim().toLowerCase();
        }
        if (payload.phone) {
          verifiedPhone = payload.phone as string;
        }
      } catch (err) {
        console.warn("Token verify notice:", err);
      }
    }

    // Fallback from request body
    if (!verifiedEmail && email) {
      verifiedEmail = email.trim().toLowerCase();
    }
    if (!verifiedPhone && phone) {
      verifiedPhone = phone.replace(/[^0-9+]/g, "");
    }

    if (!verifiedEmail && !verifiedPhone) {
      return NextResponse.json(
        { error: "A verified email address or phone number is required" },
        { status: 400 }
      );
    }

    // 2. Resolve Institution cleanly
    let resolvedInstId = institutionId;
    let isFoundingMember = false;

    // Check if institutionId exists in DB or if it's a placeholder (e.g. starts with "inst-")
    let existingInst = null;
    if (resolvedInstId && !resolvedInstId.startsWith("inst-")) {
      existingInst = await db.institution.findUnique({ where: { id: resolvedInstId } });
    }

    if (!existingInst) {
      // Find or create institution by name
      const targetName = (newInstitutionName || institutionName || "Brainware University").trim();
      const slugBase = slugify(targetName);

      existingInst = await db.institution.findFirst({
        where: {
          name: { equals: targetName },
        },
      });

      if (!existingInst) {
        const uniqueSlug = `${slugBase}-${Math.floor(1000 + Math.random() * 9000)}`;
        existingInst = await db.institution.create({
          data: {
            name: targetName,
            slug: uniqueSlug,
            type: newInstitutionType || "COLLEGE",
            city: city || null,
          },
        });
        isFoundingMember = true;
      }

      resolvedInstId = existingInst.id;
    }

    // 3. Resolve Batch Year
    const yearInt = parseInt(batchYear.toString(), 10) || new Date().getFullYear();

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

    // 4. Resolve Department (optional)
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

    // 5. Create or Update User (Upsert)
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          ...(verifiedEmail ? [{ email: verifiedEmail }] : []),
          ...(verifiedPhone ? [{ phone: verifiedPhone }] : []),
        ],
      },
    });

    let user;
    if (existingUser) {
      // Update existing user with latest profile details
      user = await db.user.update({
        where: { id: existingUser.id },
        data: {
          name: name.trim(),
          email: verifiedEmail || existingUser.email,
          phone: verifiedPhone || existingUser.phone,
          institutionId: resolvedInstId,
          departmentId: resolvedDeptId,
          batchId: batch.id,
          batchYear: yearInt,
          currentCompany: currentCompany?.trim() || existingUser.currentCompany,
          currentRole: currentRole?.trim() || existingUser.currentRole,
          city: city?.trim() || existingUser.city,
          linkedinUrl: linkedinUrl?.trim() || existingUser.linkedinUrl,
        },
        include: {
          institution: true,
          department: true,
          batch: true,
        },
      });
    } else {
      // Create new user
      user = await db.user.create({
        data: {
          email: verifiedEmail,
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

      // Generate join feed item
      try {
        await db.feedItem.create({
          data: {
            institutionId: resolvedInstId,
            actorId: user.id,
            type: "USER_JOINED",
            metadata: JSON.stringify({
              userName: user.name,
              batchYear: user.batchYear,
              department: user.department?.name,
            }),
          },
        });
      } catch (feedErr) {
        console.warn("Feed item notice:", feedErr);
      }
    }

    // 6. Set Session Cookie
    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      phone: user.phone,
    });

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("signup error:", (error as Error)?.stack || error);
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to complete signup" },
      { status: 500 }
    );
  }
}
