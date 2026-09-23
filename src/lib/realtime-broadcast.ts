import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tinoesrmhzgelxiykcgq.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DtrGzEbOc2n4oeilkvpuCQ_tj6jRqyX";

/**
 * Server-side helper to send a Realtime broadcast to a specific channel.
 * Uses Supabase HTTP REST broadcast API first (~50ms) — no WebSocket
 * subscription handshake needed. Falls back to WS subscribe if REST fails.
 */
export async function sendRealtimeBroadcast(
  channelName: string,
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  // ─── FAST PATH: Supabase REST Broadcast API ────────────────────────────
  // POST /realtime/v1/api/broadcast — sends without subscribing (~50ms).
  try {
    const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
    const restUrl = `https://${projectRef}.supabase.co/realtime/v1/api/broadcast`;

    const res = await fetch(restUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
        "apikey": supabaseKey,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: channelName,
            event,
            payload,
          },
        ],
      }),
    });

    if (res.ok) {
      return true;
    }
    // Non-2xx — fall through to WS fallback
    console.warn(`[Realtime HTTP Broadcast] Non-ok status ${res.status} for ${channelName}, falling back to WS.`);
  } catch (httpErr) {
    console.warn(`[Realtime HTTP Broadcast] fetch failed for ${channelName}, falling back to WS:`, httpErr);
  }

  // ─── FALLBACK PATH: WebSocket Subscribe-then-Send ─────────────────────
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: true } },
    });

    return await new Promise<boolean>((resolve) => {
      let isSettled = false;

      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          supabase.removeChannel(channel).catch(() => {});
          resolve(false);
        }
      }, 3000);

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !isSettled) {
          try {
            await channel.send({
              type: "broadcast",
              event,
              payload,
            });
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeout);
              supabase.removeChannel(channel).catch(() => {});
              resolve(true);
            }
          } catch (err) {
            console.warn(`[Realtime WS Broadcast] Failed to send on ${channelName}:`, err);
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeout);
              supabase.removeChannel(channel).catch(() => {});
              resolve(false);
            }
          }
        } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          supabase.removeChannel(channel).catch(() => {});
          resolve(false);
        }
      });
    });
  } catch (err) {
    console.warn(`[Realtime WS Broadcast] Exception for channel ${channelName}:`, err);
    return false;
  }
}

