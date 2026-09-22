import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sendOtpSms } from "@/lib/sms";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { SignJWT } from "jose";

export const dynamic = "force-dynamic";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "alumni-network-super-secret-jwt-key-minimum-32-characters"
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, phone } = body;

    // 1. Phone SMS OTP flow
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      const formatted10Digit = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
      if (formatted10Digit.length !== 10) {
        return NextResponse.json({ error: "Please enter a valid 10-digit mobile number" }, { status: 400 });
      }

      // Check if user already exists
      const existingUser = await db.user.findFirst({
        where: {
          OR: [
            { phone: formatted10Digit },
            { phone: `+91${formatted10Digit}` },
            { phone: `91${formatted10Digit}` },
          ],
        },
      });

      // Generate a secure 6-digit numeric OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

      // Invalidate existing unused OTPs for this phone
      await db.otpCode.updateMany({
        where: { phone: formatted10Digit, consumed: false },
        data: { consumed: true },
      });

      // Store in OtpCode table
      await db.otpCode.create({
        data: {
          phone: formatted10Digit,
          code: otpCode,
          expiresAt,
          consumed: false,
        },
      });

      // Dispatch SMS
      const smsResult = await sendOtpSms(formatted10Digit, otpCode);

      return NextResponse.json({
        success: true,
        phone: formatted10Digit,
        isExistingUser: !!existingUser,
        provider: smsResult.provider,
        message: smsResult.error
          ? `Code dispatched (Test verification code: ${otpCode})`
          : `6-digit SMS verification code sent to +91 ${formatted10Digit}`,
        notice: smsResult.error,
        testCode: process.env.NODE_ENV !== "production" || smsResult.error ? otpCode : undefined,
      });
    }

    // 2. Email flow (No OTP required: instant login for existing users, instant onboarding for new users)
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address or phone number" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists in DB by email
    const existingUser = await db.user.findFirst({
      where: { email: cleanEmail },
      include: {
        institution: true,
        department: true,
        batch: true,
      },
    });

    if (existingUser) {
      // Returning user: automatically log in directly without requiring OTP!
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
        loggedIn: true,
        user: existingUser,
        message: "Logged in successfully!",
      });

      response.cookies.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE.name, sessionToken, AUTH_COOKIE.options);

      return response;
    }

    // New user signing up with email: issue signup token directly, no OTP needed!
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
      message: "Welcome! Please enter your profile details.",
    });
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json(
      { error: "Failed to process login request. Please try again." },
      { status: 500 }
    );
  }
}
