import { NextResponse } from "next/server";
import { getCurrentUser, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("alumni_session")?.value;
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

    const user = await getCurrentUser();

    return NextResponse.json({
      authenticated: !!user,
      hasToken: !!token,
      availableCookies: allCookies,
      tokenPayload,
      dbUserFound: !!dbUser,
      dbError,
      user,
    });
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
