import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/test-sms - Test dispatching an SMS via Fast2SMS
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const { phone, message } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required (e.g. 9876543210)" }, { status: 400 });
    }

    const digits = phone.replace(/[^0-9]/g, "");
    const formatted10Digit = digits.length > 10 ? digits.slice(-10) : digits;

    if (formatted10Digit.length !== 10) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit Indian mobile number" },
        { status: 400 }
      );
    }

    const fast2SmsKey =
      process.env.FAST2SMS_API_KEY ||
      "2hiq4r5d1Ix9kKOnXbWf87EgNYvsVQDUaLAzwGeJHMyP6FtupCKQsLZj4HifGTCx5udJOFmIEBXpWeNR";

    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const smsContent = message || `Your Alumni Network test code is ${testOtp}. Live SMS gateway verified successfully!`;

    // 1. Check Fast2SMS Wallet first
    let walletData = null;
    try {
      const wRes = await fetch("https://www.fast2sms.com/dev/wallet", {
        headers: { authorization: fast2SmsKey },
      });
      walletData = await wRes.json();
    } catch (wErr) {
      console.warn("Wallet check notice:", wErr);
    }

    // 2. Dispatch via Fast2SMS Quick OTP route
    const dispatchRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: fast2SmsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "otp",
        variables_values: testOtp,
        numbers: formatted10Digit,
      }),
    });

    const dispatchData = await dispatchRes.json();

    if (dispatchData.return) {
      return NextResponse.json({
        success: true,
        provider: "fast2sms",
        recipient: `+91 ${formatted10Digit}`,
        testCodeSent: testOtp,
        requestId: dispatchData.request_id,
        walletBalance: walletData?.wallet || "Active",
        remainingSmsCount: walletData?.sms_count || "Available",
        message: `Test SMS successfully dispatched to +91 ${formatted10Digit}! Check your phone messages.`,
      });
    }

    // Fallback attempt via transactional route
    const qRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: fast2SmsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message: smsContent,
        language: "english",
        numbers: formatted10Digit,
      }),
    });

    const qData = await qRes.json();

    return NextResponse.json({
      success: qData.return || false,
      provider: "fast2sms-q",
      recipient: `+91 ${formatted10Digit}`,
      fast2SmsResponse: qData,
      message: qData.return
        ? `Test SMS dispatched via transactional route to +91 ${formatted10Digit}!`
        : (qData.message || dispatchData.message || "Failed to deliver SMS"),
    });
  } catch (error) {
    console.error("Error in /api/test-sms:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SMS dispatch error" },
      { status: 500 }
    );
  }
}
