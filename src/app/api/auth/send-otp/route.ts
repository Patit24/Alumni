import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tinoesrmhzgelxiykcgq.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DtrGzEbOc2n4oeilkvpuCQ_tj6jRqyX";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address (e.g. yourname@gmail.com)" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists in SQLite DB by email
    const existingUser = await db.user.findFirst({
      where: { email: cleanEmail },
    });

    // Dispatch 6-digit OTP directly to Gmail / Email inbox via Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: supabaseError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (supabaseError) {
      console.error("Supabase Email OTP error:", supabaseError);
      return NextResponse.json(
        {
          error: supabaseError.message || "Failed to dispatch OTP to your email.",
          code: supabaseError.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      isExistingUser: !!existingUser,
      provider: "supabase-email",
      message: `6-digit verification code sent to ${cleanEmail}`,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code. Please check your internet connection." },
      { status: 500 }
    );
  }
}
