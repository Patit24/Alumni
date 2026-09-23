import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { createServerClient } from "@supabase/ssr";
import { SignJWT } from "jose";

export const dynamic = "force-dynamic";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "alumni-network-super-secret-jwt-key-minimum-32-characters"
);

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tinoesrmhzgelxiykcgq.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        "sb_publishable_DtrGzEbOc2n4oeilkvpuCQ_tj6jRqyX",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore if called from route handler
            }
          },
        },
      }
    );

    console.log("[OAUTH-CALLBACK] Received code:", code);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[OAUTH-CALLBACK] exchangeCodeForSession error:", error);
    } else {
      console.log("[OAUTH-CALLBACK] Session exchange success! User email:", data?.user?.email);
    }

    if (!error && data?.user?.email) {
      const userEmail = data.user.email.toLowerCase().trim();
      const userName =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        userEmail.split("@")[0];
      const userAvatar =
        data.user.user_metadata?.avatar_url ||
        data.user.user_metadata?.picture ||
        "";

      // Check if user already exists
      const existingUser = await db.user.findFirst({
        where: { email: userEmail },
        include: {
          institution: true,
          department: true,
          batch: true,
        },
      });

      if (existingUser) {
        console.log("[OAUTH-CALLBACK] Existing user found, logging in:", existingUser.id);
        const sessionToken = await createSessionToken({
          userId: existingUser.id,
          email: existingUser.email,
          phone: existingUser.phone,
          name: existingUser.name,
          role: existingUser.role,
          verificationStatus: existingUser.verificationStatus,
          institutionId: existingUser.institutionId,
          institutionName: existingUser.institution?.name,
          batchYear: existingUser.batchYear,
          departmentName: existingUser.department?.name,
          currentCompany: existingUser.currentCompany,
          currentRole: existingUser.currentRole,
          city: existingUser.city,
          avatarUrl: existingUser.avatarUrl || userAvatar || null,
        });

        const redirectResponse = NextResponse.redirect(`${origin}/`);
        redirectResponse.cookies.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);
        redirectResponse.cookies.set("session_token", sessionToken, AUTH_COOKIE.options);
        return redirectResponse;
      } else {
        // Redirect to onboarding with verified email and signed token
        console.log("[OAUTH-CALLBACK] New user, redirecting to onboarding for:", userEmail);
        const signupToken = await new SignJWT({
          email: userEmail,
          purpose: "signup",
          name: userName,
          avatarUrl: userAvatar,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("2h")
          .sign(JWT_SECRET);

        return NextResponse.redirect(
          `${origin}/auth?mode=google-onboard&email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(userAvatar)}&signupToken=${encodeURIComponent(signupToken)}`
        );
      }
    }
  }

  console.log("[OAUTH-CALLBACK] Fallback redirecting to /auth");
  return NextResponse.redirect(`${origin}/auth`);
}
