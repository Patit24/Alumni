import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tinoesrmhzgelxiykcgq.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DtrGzEbOc2n4oeilkvpuCQ_tj6jRqyX";

let serverSupabase: ReturnType<typeof createClient> | null = null;

function getServerSupabase() {
  if (!serverSupabase) {
    serverSupabase = createClient(supabaseUrl, supabaseKey);
  }
  return serverSupabase;
}

export async function broadcastFeedEvent(institutionId: string, event: string, payload: unknown) {
  try {
    const supabase = getServerSupabase();
    const channel = supabase.channel(`campus-feed:${institutionId}`);
    
    await channel.send({
      type: "broadcast",
      event,
      payload,
    });
  } catch (err) {
    // Non-blocking broadcast
    console.warn("Supabase Realtime broadcast warning:", err);
  }
}
