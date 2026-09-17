import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "alumni-network-super-secret-jwt-key-minimum-32-characters"
);

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ error: "Phone number and OTP code are required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, "");

    // Verify OTP in DB
    const validOtp = await db.otpCode.findFirst({
      where: {
        phone: cleanPhone,
        code: code.trim(),
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also allow the fallback dev code if in mock mode
    const isMock = process.env.OTP_PROVIDER !== "msg91" && process.env.OTP_PROVIDER !== "firebase";
    const isMockMatch = isMock && code.trim() === (process.env.MOCK_OTP_CODE || "123456");

    if (!validOtp && !isMockMatch) {
      return NextResponse.json({ error: "Invalid or expired OTP code" }, { status: 400 });
    }

    // Mark OTP as consumed
    if (validOtp) {
      await db.otpCode.update({
        where: { id: validOtp.id },
        data: { consumed: true },
      });
    }

    // Look for existing user
    const existingUser = await db.user.findUnique({
      where: { phone: cleanPhone },
      include: {
        institution: true,
        department: true,
        batch: true,
      },
    });

    if (existingUser) {
      // Returning user: create session and set cookie
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

    // New user: create a temporary 15-minute signup token ensuring phone is verified
    const signupToken = await new SignJWT({ phone: cleanPhone, purpose: "signup" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(JWT_SECRET);

    return NextResponse.json({
      success: true,
      isNewUser: true,
      phone: cleanPhone,
      signupToken,
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 });
  }
}
