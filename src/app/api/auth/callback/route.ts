import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user?.email) {
      const userEmail = data.user.email.toLowerCase().trim();
      const userName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || userEmail.split("@")[0];

      // Check if user already exists
      const existingUser = await db.user.findFirst({
        where: { email: userEmail },
      });

      if (existingUser) {
        const sessionToken = await createSessionToken({
          userId: existingUser.id,
          email: existingUser.email,
          phone: existingUser.phone,
        });

        cookieStore.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);
        return NextResponse.redirect(`${origin}/`);
      } else {
        // Redirect to onboarding with verified email
        return NextResponse.redirect(`${origin}/auth?verifiedEmail=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName)}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth`);
}
