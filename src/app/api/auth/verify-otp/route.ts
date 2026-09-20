import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { SignJWT } from "jose";

export const dynamic = "force-dynamic";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "alumni-network-super-secret-jwt-key-minimum-32-characters"
);

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ error: "Phone number and 6-digit OTP are required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formatted10Digit = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
    const trimmedCode = code.toString().trim();

    if (trimmedCode.length !== 6) {
      return NextResponse.json({ error: "Please enter the complete 6-digit OTP" }, { status: 400 });
    }

    // Strict Database verification: Find active, unconsumed, unexpired OTP code
    const dbOtp = await db.otpCode.findFirst({
      where: {
        phone: formatted10Digit,
        code: trimmedCode,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!dbOtp) {
      return NextResponse.json(
        { error: "Invalid or expired OTP code. Please request a new OTP." },
        { status: 400 }
      );
    }

    // Immediately mark OTP as consumed to prevent replay attacks
    await db.otpCode.update({
      where: { id: dbOtp.id },
      data: { consumed: true },
    });

    // Invalidate any other pending OTPs for this phone
    await db.otpCode.updateMany({
      where: { phone: formatted10Digit, consumed: false },
      data: { consumed: true },
    });

    // Lookup user by verified phone
    const existingUser = await db.user.findUnique({
      where: { phone: formatted10Digit },
      include: {
        institution: true,
        department: true,
        batch: true,
      },
    });

    if (existingUser) {
      // Returning user: create authenticated session and set HTTP-only cookie
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

    // New user: generate signed cryptographically secure signup token
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
