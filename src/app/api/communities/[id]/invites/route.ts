import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/communities/permissions";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const community = await db.community.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    const invites = await db.communityInvite.findMany({
      where: {
        communityId: community.id,
        isRevoked: false,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ success: true, invites });
  } catch (error: any) {
    console.error("GET invites error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load invites" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const community = await db.community.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    const member = await db.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: user.id } },
      include: { role: true },
    });

    if (!can(member, "INVITE_MEMBERS", community)) {
      return NextResponse.json({ error: "Permission denied to create invites" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { assignedRoleId, maxUses, expiresInHours } = body;

    // Generate random 16-byte hex token
    const token = crypto.randomBytes(16).toString("hex");

    let expiresAt: Date | null = null;
    if (expiresInHours && Number(expiresInHours) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000);
    }

    const invite = await db.communityInvite.create({
      data: {
        communityId: community.id,
        token,
        assignedRoleId: assignedRoleId || null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt,
        createdById: user.id,
      },
    });

    const origin = req.headers.get("origin") || "https://alumni-pink.vercel.app";
    const inviteUrl = `${origin}/communities/join/${token}`;
    const qrPayload = inviteUrl;

    return NextResponse.json({
      success: true,
      invite,
      inviteUrl,
      qrPayload,
    });
  } catch (error: any) {
    console.error("POST invite error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invite" },
      { status: 500 }
    );
  }
}
