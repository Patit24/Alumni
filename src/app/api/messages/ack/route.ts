import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tinoesrmhzgelxiykcgq.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DtrGzEbOc2n4oeilkvpuCQ_tj6jRqyX";

// POST /api/messages/ack - Acknowledge delivery & purge temporary encrypted messages from server
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageIds, senderId, status = "DELIVERED" } = await req.json();

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: "messageIds array is required" }, { status: 400 });
    }

    // 1. Permanently delete acknowledged encrypted messages from server queue
    await db.encryptedMessageQueue.deleteMany({
      where: {
        id: { in: messageIds },
        recipientId: user.id,
      },
    });

    // 2. Broadcast receipt back to original sender so their UI updates to Delivered/Read
    if (senderId) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const channel = supabase.channel(`p2p-signal:${senderId}`);
        await channel.send({
          type: "broadcast",
          event: "message-status",
          payload: {
            messageIds,
            status,
            recipientId: user.id,
            timestamp: Date.now(),
          },
        });
      } catch (e) {
        console.warn("Ack broadcast error:", e);
      }
    }

    return NextResponse.json({ success: true, purgedCount: messageIds.length });
  } catch (error) {
    console.error("Error in /api/messages/ack POST:", error);
    return NextResponse.json({ error: "Failed to acknowledge messages" }, { status: 500 });
  }
}
