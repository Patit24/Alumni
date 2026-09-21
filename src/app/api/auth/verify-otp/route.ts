import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { SignJWT } from "jose";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "alumni-network-super-secret-jwt-key-minimum-32-characters"
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tinoesrmhzgelxiykcgq.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DtrGzEbOc2n4oeilkvpuCQ_tj6jRqyX";

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ error: "Phone number and 6-digit OTP are required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formatted10Digit = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
    const fullE164 = `+91${formatted10Digit}`;
    const trimmedCode = code.toString().trim();

    if (trimmedCode.length !== 6) {
      return NextResponse.json({ error: "Please enter the complete 6-digit OTP" }, { status: 400 });
    }

    // Verify OTP code via Supabase Twilio provider
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: fullE164,
      token: trimmedCode,
      type: "sms",
    });

    if (verifyError) {
      console.error("Supabase OTP verify error:", verifyError);
      return NextResponse.json(
        { error: verifyError.message || "Invalid or expired OTP code" },
        { status: 400 }
      );
    }

    // Lookup user in central database by verified phone number
    const existingUser = await db.user.findUnique({
      where: { phone: formatted10Digit },
      include: {
        institution: true,
        department: true,
        batch: true,
      },
    });

    if (existingUser) {
      // Returning user: create session and set HTTP-only cookie
      const sessionToken = await createSessionToken({
        userId: existingUser.id,
        phone: existingUser.phone,
      });

      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);

      return NextResponse.json({
        success: true,
        isNewUser: false,
        user: existingUser,
      });
    }

    // New user: create a signed JWT token ensuring phone is verified
    const signupToken = await new SignJWT({ phone: formatted10Digit, purpose: "signup" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(JWT_SECRET);

    return NextResponse.json({
      success: true,
      isNewUser: true,
      phone: formatted10Digit,
      signupToken,
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    return NextResponse.json({ error: "Failed to verify OTP. Please try again." }, { status: 500 });
  }
}
