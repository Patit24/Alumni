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
    let tokenAvatarUrl: string | null = null;

    if (signupToken) {
      try {
        const { payload } = await jwtVerify(signupToken, JWT_SECRET);
        if (payload.email) {
          verifiedEmail = (payload.email as string).trim().toLowerCase();
        }
        if (payload.phone) {
          verifiedPhone = (payload.phone as string).replace(/[^0-9+]/g, "");
        }
        if (payload.avatarUrl && typeof payload.avatarUrl === "string") {
          tokenAvatarUrl = payload.avatarUrl;
        }
      } catch (err) {
        console.warn("Signup token verification fallback:", err);
      }
    }

    const finalAvatarUrl = (body.avatarUrl || tokenAvatarUrl || "").trim() || null;

    // Direct email or phone fallback (allows seamless email registration without OTP roadblock)
    if (!verifiedEmail && email && typeof email === "string" && email.includes("@")) {
      verifiedEmail = email.trim().toLowerCase();
    }
    if (!verifiedPhone && phone && typeof phone === "string") {
      const clean = phone.replace(/[^0-9]/g, "");
      if (clean.length >= 10) {
        verifiedPhone = clean.slice(-10);
      }
    }

    if (!verifiedEmail && !verifiedPhone) {
      return NextResponse.json(
        { error: "A valid email address or mobile number is required to complete your profile." },
        { status: 400 }
      );
    }

    // Optional phone provided by user in profile form
    const contactPhone = phone ? phone.replace(/[^0-9+]/g, "") : verifiedPhone;

    // 2. Resolve Institution cleanly
    let resolvedInstId = institutionId;
    let isFoundingMember = false;

    // Check if institutionId exists in DB
    let existingInst = null;
    if (resolvedInstId) {
      existingInst = await db.institution.findUnique({ where: { id: resolvedInstId } });
    }

    if (!existingInst) {
      // Find or create institution by name
      const targetName = (newInstitutionName || institutionName || "").trim();
      if (!targetName && !resolvedInstId) {
        return NextResponse.json(
          { error: "Please select or enter your college or school name." },
          { status: 400 }
        );
      }

      if (targetName) {
        const slugBase = slugify(targetName);
        const allInsts = await db.institution.findMany({ take: 200 });
        existingInst = allInsts.find(
          (i) =>
            i.name.toLowerCase() === targetName.toLowerCase() ||
            (resolvedInstId && i.id.toLowerCase() === resolvedInstId.toLowerCase()) ||
            (resolvedInstId && i.slug.toLowerCase() === resolvedInstId.toLowerCase())
        ) || null;

        if (!existingInst) {
          const uniqueSlug = `${slugBase || "inst"}-${Math.floor(1000 + Math.random() * 9000)}`;
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
    }

    if (!existingInst) {
      return NextResponse.json(
        { error: "Please select or provide your college, university, or school." },
        { status: 400 }
      );
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

    // Helper to generate unique @username automatically
    async function generateUniqueUsername(rawName: string, year: number): Promise<string> {
      let base = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!base) base = "alumni";
      let candidate = base;
      let counter = 1;
      while (true) {
        const existing = await db.user.findUnique({ where: { username: candidate } });
        if (!existing) return candidate;
        candidate = `${base}${year || counter}`;
        counter++;
        if (counter > 20) {
          candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
        }
      }
    }

    let user;
    if (existingUser) {
      const generatedUsername = existingUser.username || (await generateUniqueUsername(name, yearInt));
      // Update existing user with latest profile details
      user = await db.user.update({
        where: { id: existingUser.id },
        data: {
          name: name.trim(),
          username: generatedUsername,
          email: verifiedEmail || existingUser.email,
          phone: contactPhone || existingUser.phone,
          institutionId: resolvedInstId,
          departmentId: resolvedDeptId,
          batchId: batch.id,
          batchYear: yearInt,
          currentCompany: currentCompany?.trim() || null,
          currentRole: currentRole?.trim() || null,
          city: city?.trim() || null,
          linkedinUrl: linkedinUrl?.trim() || null,
          avatarUrl: finalAvatarUrl || existingUser.avatarUrl || null,
        },
        include: {
          institution: true,
          department: true,
          batch: true,
        },
      });
    } else {
      const generatedUsername = await generateUniqueUsername(name, yearInt);
      // Create new user with auto-generated unique username
      user = await db.user.create({
        data: {
          email: verifiedEmail,
          phone: contactPhone,
          username: generatedUsername,
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
          avatarUrl: finalAvatarUrl || null,
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
      name: user.name,
      role: user.role,
      verificationStatus: user.verificationStatus,
      institutionId: user.institutionId,
      institutionName: user.institution?.name,
      batchYear: user.batchYear,
      departmentName: user.department?.name,
      currentCompany: user.currentCompany,
      currentRole: user.currentRole,
      city: user.city,
      avatarUrl: user.avatarUrl,
    });

    const response = NextResponse.json({
      success: true,
      token: sessionToken,
      user,
    });

    response.cookies.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);
    response.cookies.set("session_token", sessionToken, AUTH_COOKIE.options);

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);
    cookieStore.set("session_token", sessionToken, AUTH_COOKIE.options);

    return response;
  } catch (error) {
    console.error("signup error:", (error as Error)?.stack || error);
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to complete signup" },
      { status: 500 }
    );
  }
}
