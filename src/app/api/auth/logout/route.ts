import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function performLogout() {
  const cookieStore = await cookies();

  // Known authentication cookie names
  const cookiesToDelete = [
    AUTH_COOKIE.name,
    "alumni_session",
    "session_token",
    "sb-access-token",
    "sb-refresh-token",
  ];

  // Inspect and include all Supabase auth or session cookies
  try {
    const allCookies = cookieStore.getAll();
    for (const c of allCookies) {
      if (
        c.name.startsWith("sb-") ||
        c.name.includes("session") ||
        c.name.includes("token") ||
        c.name.includes("auth")
      ) {
        cookiesToDelete.push(c.name);
      }
    }
  } catch {}

  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  const uniqueNames = Array.from(new Set(cookiesToDelete));
  for (const name of uniqueNames) {
    try {
      cookieStore.delete(name);
    } catch {}

    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  return response;
}

export async function POST() {
  try {
    return await performLogout();
  } catch (error) {
    console.error("Logout POST error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const redirectUrl = `${url.origin}/auth`;
    const response = NextResponse.redirect(redirectUrl);
    const cookieStore = await cookies();

    const allCookies = cookieStore.getAll();
    for (const c of allCookies) {
      if (
        c.name.startsWith("sb-") ||
        c.name.includes("session") ||
        c.name.includes("token") ||
        c.name.includes("auth") ||
        c.name === "alumni_session"
      ) {
        try {
          cookieStore.delete(c.name);
        } catch {}
        response.cookies.set(c.name, "", {
          path: "/",
          maxAge: 0,
          expires: new Date(0),
          httpOnly: true,
        });
      }
    }
    return response;
  } catch (err) {
    console.error("Logout GET error:", err);
    return NextResponse.redirect(new URL("/auth", req.url));
  }
}
