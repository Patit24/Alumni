import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOtpSms } from "@/lib/sms";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formatted10Digit = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

    if (formatted10Digit.length < 10) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number" }, { status: 400 });
    }

    // Generate secure cryptographically random 6-digit OTP
    const generatedOtp = crypto.randomInt(100000, 999999).toString();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { phone: formatted10Digit },
    });

    // Invalidate prior unused OTPs for this phone number
    await db.otpCode.updateMany({
      where: { phone: formatted10Digit, consumed: false },
      data: { consumed: true },
    });

    // Store in database with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.otpCode.create({
      data: {
        phone: formatted10Digit,
        code: generatedOtp,
        expiresAt,
      },
    });

    // Dispatch SMS via carrier gateway
    const smsResult = await sendOtpSms(formatted10Digit, generatedOtp);

    if (!smsResult.success) {
      return NextResponse.json(
        {
          error: smsResult.error || "SMS carrier rejected the request. Please check Fast2SMS account status.",
          provider: smsResult.provider,
        },
        { status: 400 }
      );
    }

    // Return production response without leaking OTP code
    return NextResponse.json({
      success: true,
      phone: formatted10Digit,
      isExistingUser: !!existingUser,
      provider: smsResult.provider,
      message: `OTP sent successfully to +91 ${formatted10Digit}`,
    });
  } catch (error) {
    console.error("send-otp production error:", error);
    return NextResponse.json(
      { error: "Failed to send verification OTP. Please check your network and try again." },
      { status: 500 }
    );
  }
}
