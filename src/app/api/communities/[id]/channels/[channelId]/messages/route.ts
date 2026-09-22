import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/communities/permissions";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string; channelId: string }> }
) {
  try {
    const { id, channelId } = await props.params;
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

    const isOwner = user.id === community.ownerId;
    if (!member && !isOwner) {
      return NextResponse.json({ error: "You are not a member of this community" }, { status: 403 });
    }

    const channel = await db.communityChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.communityId !== community.id) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Role-restricted channel check
    if (channel.type === "ROLE_RESTRICTED" && channel.allowedRoleIds && !isOwner) {
      try {
        const allowed = JSON.parse(channel.allowedRoleIds);
        if (Array.isArray(allowed) && (!member?.role || !allowed.includes(member.role.id))) {
          return NextResponse.json({ error: "Access to this channel is restricted" }, { status: 403 });
        }
      } catch {
        // failed parse
      }
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const messages = await db.communityChannelMessage.findMany({
      where: { channelId: channel.id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    // Also fetch channel key envelope for this user's device if available
    const cryptoState = await db.communityCryptoState.findFirst({
      where: { channelId: channel.id },
      orderBy: { keyEpoch: "desc" },
    });

    return NextResponse.json({
      success: true,
      messages,
      cryptoState: cryptoState
        ? {
            keyEpoch: cryptoState.keyEpoch,
            envelopes: JSON.parse(cryptoState.encryptedKeyEnvelopes || "{}"),
          }
        : null,
    });
  } catch (error: any) {
    console.error("GET channel messages error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load channel messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string; channelId: string }> }
) {
  try {
    const { id, channelId } = await props.params;
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

    const channel = await db.communityChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.communityId !== community.id) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (!can(member, "SEND_MESSAGES", community, channel)) {
      return NextResponse.json(
        { error: "You do not have permission to send messages in this channel" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { ciphertext, iv, keyEpoch = 1, type = "TEXT", metadata } = body;

    if (!ciphertext || !iv) {
      return NextResponse.json(
        { error: "Encrypted payload (ciphertext & iv) is required" },
        { status: 400 }
      );
    }

    const message = await db.communityChannelMessage.create({
      data: {
        channelId: channel.id,
        senderId: user.id,
        ciphertext,
        iv,
        keyEpoch: Number(keyEpoch),
        type,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Realtime broadcast via Supabase
    if (supabase) {
      try {
        const realtimeChannel = supabase.channel(`community-channel:${channel.id}`);
        await realtimeChannel.send({
          type: "broadcast",
          event: "new-message",
          payload: message,
        });
      } catch (broadcastErr) {
        console.warn("Realtime broadcast failed:", broadcastErr);
      }
    }

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error("POST channel message error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send message" },
      { status: 500 }
    );
  }
}
