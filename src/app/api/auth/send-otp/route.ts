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

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { phone: cleanPhone },
    });

    // Development / Mock OTP code
    const isMock = process.env.OTP_PROVIDER !== "msg91" && process.env.OTP_PROVIDER !== "firebase";
    const otpCode = isMock ? (process.env.MOCK_OTP_CODE || "123456") : Math.floor(100000 + Math.random() * 900000).toString();

    // Expire old codes for this phone
    await db.otpCode.updateMany({
      where: { phone: cleanPhone, consumed: false },
      data: { consumed: true },
    });

    // Create fresh OTP valid for 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.otpCode.create({
      data: {
        phone: cleanPhone,
        code: otpCode,
        expiresAt,
      },
    });

    // In production, trigger SMS API (MSG91 or Firebase). In development, return devCode.
    return NextResponse.json({
      success: true,
      phone: cleanPhone,
      isExistingUser: !!existingUser,
      devCode: isMock ? otpCode : undefined,
      message: `OTP sent to ${cleanPhone}`,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
