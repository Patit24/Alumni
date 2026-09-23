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
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDesc = requestUrl.searchParams.get("error_description");

  // Check if OAuth provider returned an explicit error in search params
  if (oauthError) {
    console.warn("[OAUTH-CALLBACK] Provider returned error:", oauthError, oauthErrorDesc);
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(oauthErrorDesc || oauthError)}`
    );
  }

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

    console.log("[OAUTH-CALLBACK] Received code for exchange");
    let authUser: any = null;

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn("[OAUTH-CALLBACK] exchangeCodeForSession warning:", error.message);
        // Fallback: If code was already exchanged by an immediate parallel request (e.g. flow_state_already_used),
        // check whether Supabase already established an active user session in this browser/cookie context
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.email) {
          authUser = userData.user;
          console.log("[OAUTH-CALLBACK] Recovered user from existing session:", authUser.email);
        }
      } else if (data?.user?.email) {
        authUser = data.user;
        console.log("[OAUTH-CALLBACK] Session exchange success! User email:", authUser.email);
      }
    } catch (e: any) {
      console.warn("[OAUTH-CALLBACK] Exception during exchange:", e?.message);
      const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (userData?.user?.email) {
        authUser = userData.user;
      }
    }

    if (authUser?.email) {
      const userEmail = authUser.email.toLowerCase().trim();
      const meta = authUser.user_metadata || {};
      const userName =
        meta.full_name ||
        meta.name ||
        userEmail.split("@")[0];
      const userAvatar =
        meta.avatar_url ||
        meta.picture ||
        "";

      // 1. Check if user exists in local SQLite DB (case-insensitive)
      let existingUser = await db.user.findFirst({
        where: {
          OR: [
            { email: userEmail },
            { email: authUser.email },
          ],
        },
        include: {
          institution: true,
          department: true,
          batch: true,
        },
      });

      // 2. Self-healing: If user is not in this container's SQLite DB (due to ephemeral /tmp/dev.db on serverless),
      // check if this is an already-onboarded returning user via Supabase user metadata!
      const hasOnboarded = !!(meta.onboarded || meta.batchYear || meta.institutionName);

      if (!existingUser && hasOnboarded) {
        console.log("[OAUTH-CALLBACK] Restoring returning user into lambda DB from cloud metadata:", userEmail);
        try {
          const instName = (meta.institutionName as string) || "Campus Network";
          let inst = await db.institution.findFirst({
            where: { name: instName },
          });
          if (!inst) {
            inst = await db.institution.create({
              data: {
                name: instName,
                slug: `inst-${Math.floor(1000 + Math.random() * 9000)}`,
                type: "COLLEGE",
                city: meta.city || null,
              },
            });
          }

          const batchYearInt = parseInt(String(meta.batchYear), 10) || new Date().getFullYear();
          let batch = await db.batch.findFirst({
            where: { institutionId: inst.id, year: batchYearInt },
          });
          if (!batch) {
            batch = await db.batch.create({
              data: { institutionId: inst.id, year: batchYearInt, estimatedSize: 60 },
            });
          }

          let dept = null;
          if (meta.departmentName) {
            dept = await db.department.findFirst({
              where: { institutionId: inst.id, name: meta.departmentName },
            });
            if (!dept) {
              dept = await db.department.create({
                data: { institutionId: inst.id, name: meta.departmentName },
              });
            }
          }

          const fallbackUsername = `${userEmail.split("@")[0].replace(/[^a-z0-9]/g, "")}_${Math.random().toString(36).substring(2, 5)}`;
          existingUser = await db.user.create({
            data: {
              email: userEmail,
              name: userName,
              username: meta.username || fallbackUsername,
              avatarUrl: userAvatar || null,
              role: meta.role || "USER",
              verificationStatus: meta.verificationStatus || "UNVERIFIED",
              institutionId: inst.id,
              batchId: batch.id,
              batchYear: batchYearInt,
              departmentId: dept?.id || null,
              city: meta.city || null,
              currentCompany: meta.currentCompany || null,
              currentRole: meta.currentRole || null,
            },
            include: {
              institution: true,
              department: true,
              batch: true,
            },
          });
        } catch (restoreErr) {
          console.error("[OAUTH-CALLBACK] Failed to restore user to local SQLite:", restoreErr);
        }
      }

      if (existingUser) {
        console.log("[OAUTH-CALLBACK] User authenticated successfully:", existingUser.id, userEmail);
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

        // Redirect to homepage with both HTTP cookie AND token in param for localStorage fallback
        const redirectResponse = NextResponse.redirect(
          `${origin}/?login_success=1&token=${encodeURIComponent(sessionToken)}`
        );
        redirectResponse.cookies.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);
        redirectResponse.cookies.set("session_token", sessionToken, AUTH_COOKIE.options);
        return redirectResponse;
      } else {
        // Brand new user: redirect to onboarding with verified email and signed token
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
