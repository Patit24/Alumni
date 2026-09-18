import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/verification - Get verification dashboard state for current user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch batchmates from same institution and batch
    const batchmates = await db.user.findMany({
      where: {
        institutionId: user.institutionId,
        batchYear: user.batchYear,
        id: { not: user.id },
      },
      include: {
        department: true,
        vouchesGiven: true,
        vouchesReceived: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // 2. Fetch vouches given by or received by current user
    const vouchesReceived = await db.verificationVouch.findMany({
      where: { targetUserId: user.id },
      include: { confirmer: true },
    });

    const vouchesGiven = await db.verificationVouch.findMany({
      where: { confirmerId: user.id },
    });

    // 3. Get batch statistics for virality counter
    const totalBatchCount = await db.user.count({
      where: {
        institutionId: user.institutionId,
        batchYear: user.batchYear,
      },
    });

    const verifiedBatchCount = await db.user.count({
      where: {
        institutionId: user.institutionId,
        batchYear: user.batchYear,
        verificationStatus: "VERIFIED",
      },
    });

    const batchInfo = await db.batch.findUnique({
      where: {
        institutionId_year: {
          institutionId: user.institutionId,
          year: user.batchYear,
        },
      },
    });

    const estimatedBatchSize = batchInfo?.estimatedSize || 60;

    return NextResponse.json({
      currentUser: {
        id: user.id,
        name: user.name,
        verificationStatus: user.verificationStatus,
        batchYear: user.batchYear,
        institutionName: user.institution.name,
      },
      virality: {
        joinedCount: totalBatchCount,
        verifiedCount: verifiedBatchCount,
        estimatedSize: estimatedBatchSize,
      },
      batchmates,
      vouchesReceived,
      vouchesGivenIds: vouchesGiven.map((v) => v.targetUserId),
    });
  } catch (error) {
    console.error("Verification GET error:", error);
    return NextResponse.json({ error: "Failed to fetch verification info" }, { status: 500 });
  }
}

// POST /api/verification - Vouch for a batchmate or trigger a demo vouch
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId, action } = body;

    // Special action for testing: self-verify using a verified batchmate vouch
    if (action === "SELF_VERIFY_DEMO") {
      const verifiedBatchmate = await db.user.findFirst({
        where: {
          institutionId: user.institutionId,
          batchYear: user.batchYear,
          verificationStatus: "VERIFIED",
          id: { not: user.id },
        },
      });

      if (!verifiedBatchmate) {
        return NextResponse.json(
          { error: "No verified batchmate found to vouch for you in this batch." },
          { status: 400 }
        );
      }

      // Create vouch record
      await db.verificationVouch.upsert({
        where: {
          confirmerId_targetUserId: {
            confirmerId: verifiedBatchmate.id,
            targetUserId: user.id,
          },
        },
        create: {
          confirmerId: verifiedBatchmate.id,
          targetUserId: user.id,
        },
        update: {},
      });

      // Update current user to VERIFIED
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          verificationStatus: "VERIFIED",
          verifiedAt: new Date(),
          verifiedById: verifiedBatchmate.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: `${verifiedBatchmate.name} verified you! You are now a Verified Member.`,
        user: updatedUser,
      });
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    // Standard vouch: Current user vouches for targetUserId
    if (user.verificationStatus !== "VERIFIED") {
      return NextResponse.json(
        { error: "Only verified members can vouch for batchmates." },
        { status: 403 }
      );
    }

    // Verify target belongs to same institution and batch
    const target = await db.user.findUnique({
      where: { id: targetUserId },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.institutionId !== user.institutionId || target.batchYear !== user.batchYear) {
      return NextResponse.json(
        { error: "You can only vouch for batchmates from your institution and batch year." },
        { status: 400 }
      );
    }

    // Record vouch
    await db.verificationVouch.upsert({
      where: {
        confirmerId_targetUserId: {
          confirmerId: user.id,
          targetUserId: target.id,
        },
      },
      create: {
        confirmerId: user.id,
        targetUserId: target.id,
      },
      update: {},
    });

    // Update target user status to VERIFIED
    const updatedTarget = await db.user.update({
      where: { id: target.id },
      data: {
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
        verifiedById: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `You successfully verified ${target.name}!`,
      targetUser: updatedTarget,
    });
  } catch (error) {
    console.error("Verification POST error:", error);
    return NextResponse.json({ error: "Failed to process verification" }, { status: 500 });
  }
}
