import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/contacts/trust?contactId=...
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId")?.trim();
    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    // 1. My trust settings towards this contact
    const myTrust = await db.contactTrust.findUnique({
      where: {
        userId_contactId: {
          userId: user.id,
          contactId,
        },
      },
    });

    // 2. Peer's trust settings towards me (to know what they revealed to me)
    const peerTrust = await db.contactTrust.findUnique({
      where: {
        userId_contactId: {
          userId: contactId,
          contactId: user.id,
        },
      },
    });

    let effectiveTrustLevel = myTrust?.trustLevel || "REQUEST";

    // Guarantee: once connected via any flow (QR scan, network request accept, directory),
    // users remain connected permanently and never revert to REQUEST
    if (effectiveTrustLevel !== "CONNECTED" && effectiveTrustLevel !== "TRUSTED" && effectiveTrustLevel !== "BLOCKED") {
      const [peerIsConnected, acceptedReq] = await Promise.all([
        peerTrust?.trustLevel === "CONNECTED" || peerTrust?.trustLevel === "TRUSTED",
        db.connectionRequest.findFirst({
          where: {
            OR: [
              { senderId: user.id, receiverId: contactId, status: { in: ["ACCEPTED", "CONNECTED"] } },
              { senderId: contactId, receiverId: user.id, status: { in: ["ACCEPTED", "CONNECTED"] } },
            ],
          },
        }),
      ]);

      if (peerIsConnected || acceptedReq) {
        effectiveTrustLevel = "CONNECTED";
        // Auto-heal myTrust so future queries find it immediately
        db.contactTrust.upsert({
          where: { userId_contactId: { userId: user.id, contactId } },
          update: { trustLevel: "CONNECTED" },
          create: { userId: user.id, contactId, trustLevel: "CONNECTED" },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      trustLevel: effectiveTrustLevel,
      isVerified: Boolean(myTrust?.verifiedFingerprint),
      verifiedFingerprint: myTrust?.verifiedFingerprint || null,
      myReveals: {
        phone: myTrust?.revealedPhone || false,
        email: myTrust?.revealedEmail || false,
        work: myTrust?.revealedWork || false,
      },
      peerReveals: {
        phone: peerTrust?.revealedPhone || false,
        email: peerTrust?.revealedEmail || false,
        work: peerTrust?.revealedWork || false,
      },
    });
  } catch (error: any) {
    console.error("Fetch contact trust error:", error);
    return NextResponse.json({ error: "Failed to fetch trust state" }, { status: 500 });
  }
}

// POST /api/contacts/trust
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      contactId,
      trustLevel,
      revealedPhone,
      revealedEmail,
      revealedWork,
      verifiedFingerprint,
    } = body;

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const validLevels = ["UNKNOWN", "REQUEST", "CONNECTED", "TRUSTED", "BLOCKED"];
    if (trustLevel && !validLevels.includes(trustLevel)) {
      return NextResponse.json({ error: "Invalid trust level" }, { status: 400 });
    }

    const updateData: any = {};
    if (trustLevel) updateData.trustLevel = trustLevel;
    if (typeof revealedPhone === "boolean") updateData.revealedPhone = revealedPhone;
    if (typeof revealedEmail === "boolean") updateData.revealedEmail = revealedEmail;
    if (typeof revealedWork === "boolean") updateData.revealedWork = revealedWork;
    if (verifiedFingerprint !== undefined) {
      updateData.verifiedFingerprint = verifiedFingerprint;
      updateData.verifiedAt = verifiedFingerprint ? new Date() : null;
    }

    const trust = await db.contactTrust.upsert({
      where: {
        userId_contactId: {
          userId: user.id,
          contactId,
        },
      },
      update: updateData,
      create: {
        userId: user.id,
        contactId,
        trustLevel: trustLevel || "REQUEST",
        revealedPhone: revealedPhone || false,
        revealedEmail: revealedEmail || false,
        revealedWork: revealedWork || false,
        verifiedFingerprint: verifiedFingerprint || null,
        verifiedAt: verifiedFingerprint ? new Date() : null,
      },
    });

    // If setting to CONNECTED or TRUSTED, also write the reverse trust record so both
    // users see each other as connected on any subsequent page load (bidirectional persistence).
    if (trustLevel === "CONNECTED" || trustLevel === "TRUSTED") {
      await db.contactTrust.upsert({
        where: {
          userId_contactId: {
            userId: contactId,
            contactId: user.id,
          },
        },
        update: { trustLevel },
        create: {
          userId: contactId,
          contactId: user.id,
          trustLevel,
        },
      }).catch(() => {}); // non-fatal if reverse record can't be created
    }

    return NextResponse.json({ success: true, trust });
  } catch (error: any) {
    console.error("Update contact trust error:", error);
    return NextResponse.json({ error: "Failed to update trust state" }, { status: 500 });
  }
}
