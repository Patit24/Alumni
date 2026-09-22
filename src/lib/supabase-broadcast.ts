import { sendRealtimeBroadcast } from "./realtime-broadcast";

export async function broadcastFeedEvent(institutionId: string | null | undefined, event: string, payload: unknown) {
  try {
    const payloadObj = (typeof payload === "object" && payload !== null ? payload : { data: payload }) as Record<string, unknown>;
    
    // Broadcast to global feed channel (active in FeedSection)
    sendRealtimeBroadcast("campus-feed-global", event, payloadObj).catch(() => {});

    // Also broadcast to specific institution channel
    if (institutionId) {
      sendRealtimeBroadcast(`campus-feed:${institutionId}`, event, payloadObj).catch(() => {});
    }
  } catch (err) {
    console.warn("Supabase Realtime feed broadcast warning:", err);
  }
}
