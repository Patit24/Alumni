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
    const { email, phone, code } = await req.json();

    if ((!email && !phone) || !code) {
      return NextResponse.json({ error: "Email/Phone and 6-digit OTP code are required" }, { status: 400 });
    }

    const trimmedCode = code.toString().trim();
    if (trimmedCode.length !== 6) {
      return NextResponse.json({ error: "Please enter the complete 6-digit verification code" }, { status: 400 });
    }

    // A. Phone OTP Verification
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      const formatted10Digit = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

      // Find valid OTP record
      const otpRecord = await db.otpCode.findFirst({
        where: {
          phone: formatted10Digit,
          code: trimmedCode,
          consumed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!otpRecord) {
        return NextResponse.json(
          { error: "Invalid or expired 6-digit code. Please request a new SMS OTP." },
          { status: 400 }
        );
      }

      // Mark OTP as consumed
      await db.otpCode.update({
        where: { id: otpRecord.id },
        data: { consumed: true },
      });

      // Find existing user by phone
      const existingUser = await db.user.findFirst({
        where: {
          OR: [
            { phone: formatted10Digit },
            { phone: `+91${formatted10Digit}` },
            { phone: `91${formatted10Digit}` },
          ],
        },
        include: {
          institution: true,
          department: true,
          batch: true,
        },
      });

      if (existingUser) {
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

      // New user via Phone: issue signed signupToken
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
    }

    // B. Email OTP Verification via Supabase
    const cleanEmail = email.trim().toLowerCase();
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
