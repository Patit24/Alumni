import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "alumni-network-super-secret-jwt-key-minimum-32-characters"
);

const SESSION_COOKIE_NAME = "alumni_session";

export interface SessionPayload {
  userId: string;
  phone?: string | null;
  email?: string | null;
  username?: string | null;
  name?: string | null;
  role?: string | null;
  verificationStatus?: string | null;
  institutionId?: string | null;
  institutionName?: string | null;
  batchYear?: number | null;
  departmentName?: string | null;
  course?: string | null;
  currentCompany?: string | null;
  currentRole?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  [key: string]: unknown;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  // Strip huge base64 images from JWT to guarantee cookie is well under 4KB limit
  const cleanPayload = { ...payload };
  if (typeof cleanPayload.avatarUrl === "string" && (cleanPayload.avatarUrl.length > 300 || cleanPayload.avatarUrl.startsWith("data:"))) {
    delete cleanPayload.avatarUrl;
  }
  if (typeof cleanPayload.coverUrl === "string" && (cleanPayload.coverUrl.length > 300 || cleanPayload.coverUrl.startsWith("data:"))) {
    delete cleanPayload.coverUrl;
  }

  return new SignJWT(cleanPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: (payload.userId as string) || (payload.sub as string) || "",
      phone: (payload.phone as string) || null,
      email: (payload.email as string) || null,
      username: (payload.username as string) || null,
      name: (payload.name as string) || null,
      role: (payload.role as string) || null,
      verificationStatus: (payload.verificationStatus as string) || null,
      institutionId: (payload.institutionId as string) || null,
      institutionName: (payload.institutionName as string) || null,
      batchYear: typeof payload.batchYear === "number" ? payload.batchYear : payload.batchYear ? parseInt(String(payload.batchYear), 10) : null,
      departmentName: (payload.departmentName as string) || null,
      course: (payload.course as string) || null,
      currentCompany: (payload.currentCompany as string) || null,
      currentRole: (payload.currentRole as string) || null,
      city: (payload.city as string) || null,
      avatarUrl: (payload.avatarUrl as string) || null,
      coverUrl: (payload.coverUrl as string) || null,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(explicitToken?: string | null) {
  try {
    const cookieStore = await cookies();
    let payload: SessionPayload | null = null;

    // 1. Try explicit token first if provided and non-empty
    if (explicitToken && explicitToken !== "null" && explicitToken !== "undefined" && explicitToken.trim()) {
      payload = await verifySessionToken(explicitToken.trim());
    }

    // 2. Check Authorization header for Bearer token (critical for mobile webviews / capacitor)
    if (!payload) {
      try {
        const reqHeaders = await headers();
        const authHeader = reqHeaders.get("authorization") || reqHeaders.get("Authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const bearer = authHeader.slice(7).trim();
          if (bearer && bearer !== "null" && bearer !== "undefined") {
            payload = await verifySessionToken(bearer);
          }
        }
      } catch {
        // Headers might not be available in some contexts, fall through
      }
    }

    // 3. If explicit or header token is missing or failed verification, fall back to cookies
    if (!payload) {
      const cookieToken =
        cookieStore.get(SESSION_COOKIE_NAME)?.value ||
        cookieStore.get("session_token")?.value;
      if (cookieToken) {
        payload = await verifySessionToken(cookieToken);
      }
    }

    if (!payload?.userId && !payload?.email) {
      return null;
    }

    // 1. Try finding in DB by userId
    let user = null;
    if (payload.userId) {
      try {
        user = await db.user.findUnique({
          where: { id: payload.userId },
          include: {
            institution: true,
            department: true,
            batch: true,
          },
        });
      } catch (e) {
        console.warn("[getCurrentUser] findUnique error:", e);
      }
    }

    // 2. If not found by userId, try finding by email (case-insensitive)
    if (!user && payload.email) {
      try {
        const cleanEmail = payload.email.trim().toLowerCase();
        user = await db.user.findFirst({
          where: {
            OR: [
              { email: cleanEmail },
              { email: payload.email.trim() },
            ],
          },
          include: {
            institution: true,
            department: true,
            batch: true,
          },
        });
      } catch (e) {
        console.warn("[getCurrentUser] findFirst by email error:", e);
      }
    }

    if (user) {
      if (
        payload.institutionName &&
        typeof payload.institutionName === "string" &&
        payload.institutionName.trim() &&
        user.institution?.name !== payload.institutionName.trim()
      ) {
        const desiredName = payload.institutionName.trim();
        try {
          const allInsts = await db.institution.findMany({ take: 200 });
          let matchedInst = allInsts.find(
            (i) =>
              i.name.toLowerCase() === desiredName.toLowerCase() ||
              (payload.institutionId && i.id.toLowerCase() === (payload.institutionId as string).toLowerCase())
          );
          if (!matchedInst) {
            const slugBase = desiredName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            matchedInst = await db.institution.create({
              data: {
                name: desiredName,
                slug: `${slugBase || "inst"}-${Date.now().toString(36)}`,
                type: "COLLEGE",
              },
            });
          }
          user = await db.user.update({
            where: { id: user.id },
            data: { institutionId: matchedInst.id },
            include: {
              institution: true,
              department: true,
              batch: true,
            },
          });
        } catch (syncErr) {
          console.warn("[getCurrentUser] DB sync error for institution:", syncErr);
          if (user.institution) {
            user.institution.name = desiredName;
          }
        }
      }
      return user;
    }

    // If user is not found in database by userId or email, session is invalid
    return null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

export const AUTH_COOKIE = {
  name: SESSION_COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
