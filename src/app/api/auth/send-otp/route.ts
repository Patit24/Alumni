import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";
import { sendOtpSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tinoesrmhzgelxiykcgq.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DtrGzEbOc2n4oeilkvpuCQ_tj6jRqyX";

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

    // 2. Email OTP flow
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address or phone number" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists in SQLite DB by email
    const existingUser = await db.user.findFirst({
      where: { email: cleanEmail },
    });

    // Dispatch 6-digit OTP directly to Gmail / Email inbox via Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: supabaseError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (supabaseError) {
      console.error("Supabase Email OTP error:", supabaseError);
      return NextResponse.json(
        {
          error: supabaseError.message || "Failed to dispatch OTP to your email.",
          code: supabaseError.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      isExistingUser: !!existingUser,
      provider: "supabase-email",
      message: `6-digit verification code sent to ${cleanEmail}`,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code. Please check your internet connection." },
      { status: 500 }
    );
  }
}
