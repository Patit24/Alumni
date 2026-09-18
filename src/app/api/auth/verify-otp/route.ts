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
    const trimmedCode = code.toString().trim();

    // Accept demo OTP "123456" unconditionally
    const isDemoCode = trimmedCode === "123456";

    let validOtp = false;
    let existingUser = null;

    try {
      const dbOtp = await db.otpCode.findFirst({
        where: {
          phone: cleanPhone,
          code: trimmedCode,
          consumed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (dbOtp) {
        validOtp = true;
        await db.otpCode.update({
          where: { id: dbOtp.id },
          data: { consumed: true },
        });
      }

      existingUser = await db.user.findUnique({
        where: { phone: cleanPhone },
        include: {
          institution: true,
          department: true,
          batch: true,
        },
      });
    } catch (dbErr) {
      console.warn("DB notice in verify-otp:", dbErr);
    }

    if (!validOtp && !isDemoCode) {
      return NextResponse.json(
        { error: "Invalid OTP code. Please use demo OTP: 123456" },
        { status: 400 }
      );
    }

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
