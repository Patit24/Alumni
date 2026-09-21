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
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formatted10Digit = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
    const fullE164 = `+91${formatted10Digit}`;

    if (formatted10Digit.length < 10) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number" }, { status: 400 });
    }

    // Check if user already exists in SQLite DB
    const existingUser = await db.user.findUnique({
      where: { phone: formatted10Digit },
    });

    // Dispatch OTP directly via Supabase Auth connected to Twilio
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: supabaseError } = await supabase.auth.signInWithOtp({
      phone: fullE164,
    });

    if (supabaseError) {
      console.error("Supabase Twilio OTP error:", supabaseError);
      return NextResponse.json(
        {
          error: supabaseError.message || "Failed to send SMS via Twilio",
          code: supabaseError.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      phone: formatted10Digit,
      isExistingUser: !!existingUser,
      provider: "supabase-twilio",
      message: `OTP sent successfully via Twilio to +91 ${formatted10Digit}`,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code. Please check your network and try again." },
      { status: 500 }
    );
  }
}
