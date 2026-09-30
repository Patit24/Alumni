import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ttlSeconds = 7200; // 2 hours
    const expiryTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const turnUsername = `${expiryTimestamp}:${user.id}`;
    const turnSecret = process.env.TURN_SECRET || process.env.AUTH_SECRET || "samparka_turn_fallback_secret";

    const turnCredential = crypto
      .createHmac("sha1", turnSecret)
      .update(turnUsername)
      .digest("base64");

    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp",
        ],
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ];

    // If dedicated CoTurn cluster is configured via environment
    if (process.env.NEXT_PUBLIC_TURN_URLS) {
      const customUrls = process.env.NEXT_PUBLIC_TURN_URLS.split(",").map((u) => u.trim());
      iceServers.unshift({
        urls: customUrls,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    return NextResponse.json({
      success: true,
      iceServers,
      ttl: ttlSeconds,
      expiresAt: expiryTimestamp,
    });
  } catch (error) {
    console.error("TURN credentials generation error:", error);
    return NextResponse.json({ error: "Failed to generate TURN credentials" }, { status: 500 });
  }
}
