import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tinoesrmhzgelxiykcgq.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DtrGzEbOc2n4oeilkvpuCQ_tj6jRqyX";

/**
 * Server-side helper to send a Realtime broadcast to a specific channel.
 * Guarantees channel subscription before sending, preventing dropped events.
 */
export async function sendRealtimeBroadcast(
  channelName: string,
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
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
            console.warn(`[Realtime Broadcast] Failed to send on ${channelName}:`, err);
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
    console.warn(`[Realtime Broadcast] Exception for channel ${channelName}:`, err);
    return false;
  }
}
