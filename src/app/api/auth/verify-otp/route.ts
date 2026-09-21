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
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Email address and 6-digit OTP code are required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const trimmedCode = code.toString().trim();

    if (trimmedCode.length !== 6) {
      return NextResponse.json({ error: "Please enter the complete 6-digit verification code" }, { status: 400 });
    }

    // Verify 6-digit code via Supabase Email Auth
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: trimmedCode,
      type: "email",
    });

    if (verifyError) {
      console.error("Supabase OTP verify error:", verifyError);
      return NextResponse.json(
        { error: verifyError.message || "Invalid or expired verification code. Please check your Gmail inbox." },
        { status: 400 }
      );
    }

    // Lookup user in central database by verified email
    const existingUser = await db.user.findFirst({
      where: { email: cleanEmail },
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
      });

      const response = NextResponse.json({
        success: true,
        isNewUser: false,
        user: existingUser,
      });

      response.cookies.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);

      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);

      return response;
    }

    // New user: create a signed JWT token ensuring email is verified
    const signupToken = await new SignJWT({ email: cleanEmail, purpose: "signup" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(JWT_SECRET);

    return NextResponse.json({
      success: true,
      isNewUser: true,
      email: cleanEmail,
      signupToken,
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    return NextResponse.json({ error: "Failed to verify code. Please try again." }, { status: 500 });
  }
}
