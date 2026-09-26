import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { createServerClient } from "@supabase/ssr";
import { SignJWT } from "jose";
import { saveOAuthResult } from "@/lib/oauth-store";

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

      const appSession = requestUrl.searchParams.get("app_session") || "";
      const isApp =
        requestUrl.searchParams.get("app") === "1" ||
        !!appSession ||
        req.headers.get("x-requested-with") === "com.alumni.app";

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

        if (appSession) {
          saveOAuthResult(appSession, {
            ready: true,
            token: sessionToken,
            mode: "login",
          });
        }

        if (isApp) {
          const deepLink = `samparka://auth?token=${encodeURIComponent(sessionToken)}`;
          const intentLink = `intent://auth?token=${encodeURIComponent(sessionToken)}#Intent;scheme=samparka;package=com.alumni.app;end`;
          return renderAppRedirectHtml({
            deepLink,
            intentLink,
            sessionToken,
            title: "Authenticated!",
            subtitle: "Returning to your Samparka app...",
          });
        }

        // Standard web browser redirect
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

        if (appSession) {
          saveOAuthResult(appSession, {
            ready: true,
            mode: "google-onboard",
            email: userEmail,
            name: userName,
            avatar: userAvatar,
            signupToken: signupToken,
          });
        }

        if (isApp) {
          const deepLink = `samparka://auth?mode=google-onboard&email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(userAvatar)}&signupToken=${encodeURIComponent(signupToken)}`;
          const intentLink = `intent://auth?mode=google-onboard&email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(userAvatar)}&signupToken=${encodeURIComponent(signupToken)}#Intent;scheme=samparka;package=com.alumni.app;end`;
          return renderAppRedirectHtml({
            deepLink,
            intentLink,
            title: "Welcome to Samparka!",
            subtitle: "Completing profile setup in app...",
          });
        }

        return NextResponse.redirect(
          `${origin}/auth?mode=google-onboard&email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(userAvatar)}&signupToken=${encodeURIComponent(signupToken)}`
        );
      }
    }
  }

  console.log("[OAUTH-CALLBACK] Fallback redirecting to /auth");
  return NextResponse.redirect(`${origin}/auth`);
}

function renderAppRedirectHtml({
  deepLink,
  intentLink,
  sessionToken,
  title,
  subtitle,
}: {
  deepLink: string;
  intentLink: string;
  sessionToken?: string;
  title: string;
  subtitle: string;
}) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #080811;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: #111222;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 36px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .logo {
      width: 68px;
      height: 68px;
      border-radius: 18px;
      object-fit: cover;
      margin-bottom: 20px;
      border: 2px solid rgba(255, 255, 255, 0.2);
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3.5px solid rgba(255, 255, 255, 0.1);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 14px 20px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      border-radius: 14px;
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
      transition: transform 0.15s ease;
    }
    .btn:active {
      transform: scale(0.98);
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="/images/samparka_logo.png" alt="Samparka" class="logo" />
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <div class="spinner"></div>
    <a href="${deepLink}" id="launch-btn" class="btn">Open Samparka App</a>
  </div>
  <script>
    (function() {
      var dl = ${JSON.stringify(deepLink)};
      var il = ${JSON.stringify(intentLink)};
      
      try {
        window.location.href = dl;
      } catch (e) {}

      setTimeout(function() {
        try {
          window.location.href = il;
        } catch (e) {}
      }, 400);
    })();
  </script>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });

  if (sessionToken) {
    response.cookies.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);
    response.cookies.set("session_token", sessionToken, AUTH_COOKIE.options);
  }

  return response;
}
