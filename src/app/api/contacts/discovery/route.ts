import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const DISCOVERY_SALT = "alumni_disc_v1:";

function hashPhoneNumber(tenDigits: string): string {
  return crypto
    .createHash("sha256")
    .update(DISCOVERY_SALT + tenDigits)
    .digest("hex");
}

// POST /api/contacts/discovery - Signal-style private contact discovery
// Client sends only cryptographic SHA-256 hashes of contact phone numbers.
// The server NEVER receives, inspects, stores, or logs the user's address book.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { phoneHashes } = await req.json();
    if (!Array.isArray(phoneHashes) || phoneHashes.length === 0) {
      return NextResponse.json({ error: "phoneHashes array required" }, { status: 400 });
    }

    const searchHashSet = new Set<string>(
      phoneHashes.map((h: string) => String(h).toLowerCase().trim()).filter(Boolean)
    );

    // Fetch registered users with optional discovery phone numbers (excluding myself)
    const candidates = await db.user.findMany({
      where: {
        id: { not: user.id },
        phone: { not: null },
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

    const matches = [];
    for (const candidate of candidates) {
      if (!candidate.phone) continue;
      const digits = candidate.phone.replace(/[^0-9]/g, "");
      if (digits.length < 10) continue;
      const last10 = digits.slice(-10);
      const computedHash = hashPhoneNumber(last10);

      if (searchHashSet.has(computedHash)) {
        matches.push({
          id: candidate.id,
          name: candidate.name,
          username: candidate.username || `@${candidate.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
          batchYear: candidate.batchYear,
          role: candidate.currentRole || "Alumni Member",
          company: candidate.currentCompany,
          institutionName: candidate.institution.name,
          verificationStatus: candidate.verificationStatus,
          messageUrl: `/messages/${candidate.id}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      matches,
      matchCount: matches.length,
      privacyPolicy: "Signal-style zero address book storage. Hashes processed ephemerally in memory.",
    });
  } catch (error: any) {
    console.error("Private contact discovery error:", error);
    return NextResponse.json({ error: "Failed to perform contact discovery" }, { status: 500 });
  }
}
