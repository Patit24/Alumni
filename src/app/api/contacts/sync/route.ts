import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/contacts/sync - Discover which contacts from address book have accounts on the app
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { phoneNumbers } = await req.json();
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json({ error: "phoneNumbers array is required" }, { status: 400 });
    }

    // Normalize phone numbers (support 10-digit Indian numbers and +91 format)
    const normalizedMap = new Map<string, string>(); // normalized -> original
    const searchVariants: string[] = [];

    for (const raw of phoneNumbers) {
      if (!raw || typeof raw !== "string") continue;
      const digits = raw.replace(/[^0-9]/g, "");
      if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        normalizedMap.set(last10, raw);
        searchVariants.push(last10, `+91${last10}`, `91${last10}`);
      }
    }

    // Query database for users matching any of the phone number variants
    const matchedUsers = await db.user.findMany({
      where: {
        id: { not: user.id }, // exclude myself
        OR: [
          { phone: { in: searchVariants } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        currentRole: true,
        currentCompany: true,
        batchYear: true,
        verificationStatus: true,
        institution: { select: { name: true } },
      },
    });

    const registeredUserPhones = new Set<string>();
    const registered = matchedUsers.map((u) => {
      if (u.phone) {
        const d = u.phone.replace(/[^0-9]/g, "").slice(-10);
        registeredUserPhones.add(d);
      }
      return {
        id: u.id,
        name: u.name,
        username: u.username || `@${u.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        batchYear: u.batchYear,
        role: u.currentRole || "Alumni Member",
        company: u.currentCompany,
        institutionName: u.institution.name,
        messageUrl: `/messages/${u.id}`,
      };
    });

    // Contacts not yet registered -> provide direct SMS invite payload
    const inviteText = `Hey! I'm on our Alumni Network app. Connect with batchmates and join encrypted chats here: https://alumni-pink.vercel.app`;
    const unregistered: { phone: string; inviteSmsUrl: string }[] = [];

    for (const [last10, original] of normalizedMap.entries()) {
      if (!registeredUserPhones.has(last10)) {
        unregistered.push({
          phone: original,
          inviteSmsUrl: `sms:${original}?body=${encodeURIComponent(inviteText)}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalChecked: normalizedMap.size,
      registeredCount: registered.length,
      unregisteredCount: unregistered.length,
      registered,
      unregistered,
    });
  } catch (error) {
    console.error("Error in /api/contacts/sync:", error);
    return NextResponse.json({ error: "Failed to match contacts" }, { status: 500 });
  }
}
