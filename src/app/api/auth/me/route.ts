import { NextResponse } from "next/server";
import { getCurrentUser, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    const cookieStore = await cookies();
    const cookieToken =
      cookieStore.get("alumni_session")?.value ||
      cookieStore.get("session_token")?.value;

    const token = cookieToken || bearerToken;
    const allCookies = cookieStore.getAll().map((c) => c.name);

    let tokenPayload = null;
    let dbUser = null;
    let dbError = null;

    if (token) {
      tokenPayload = await verifySessionToken(token);
      if (tokenPayload?.userId) {
        try {
          dbUser = await db.user.findUnique({
            where: { id: tokenPayload.userId },
            include: { institution: true, department: true, batch: true },
          });
        } catch (err: unknown) {
          dbError = err instanceof Error ? err.message : String(err);
        }
      }
    }

    const user = await getCurrentUser(token);

    const response = NextResponse.json({
      authenticated: !!user,
      hasToken: !!token,
      token: token || undefined,
      availableCookies: allCookies,
      tokenPayload,
      dbUserFound: !!dbUser,
      dbError,
      user,
    });

    // If authenticated via bearer token but cookies were missing/dropped by browser/iframe,
    // re-hydrate the cookies on this response
    if (token && user && !cookieToken) {
      response.cookies.set("alumni_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      response.cookies.set("session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      {
        authenticated: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
