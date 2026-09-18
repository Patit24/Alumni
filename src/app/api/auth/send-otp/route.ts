import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: "Phone number must be at least 10 digits" }, { status: 400 });
    }

    const demoCode = "123456";
    let isExistingUser = false;

    try {
      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { phone: cleanPhone },
      });
      isExistingUser = !!existingUser;

      // Expire old codes for this phone
      await db.otpCode.updateMany({
        where: { phone: cleanPhone, consumed: false },
        data: { consumed: true },
      });

      // Create fresh OTP record valid for 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await db.otpCode.create({
        data: {
          phone: cleanPhone,
          code: demoCode,
          expiresAt,
        },
      });
    } catch (dbErr) {
      console.warn("DB notice in send-otp (falling back to memory demo OTP):", dbErr);
    }

    return NextResponse.json({
      success: true,
      phone: cleanPhone,
      isExistingUser,
      devCode: demoCode,
      demoOtp: demoCode,
      message: `Demo OTP sent: ${demoCode}`,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    // Even in case of unexpected error, allow demo flow to continue
    return NextResponse.json({
      success: true,
      devCode: "123456",
      demoOtp: "123456",
      message: "Demo OTP is 123456",
    });
  }
}
