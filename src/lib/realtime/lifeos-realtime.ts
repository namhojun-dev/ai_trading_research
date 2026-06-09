import { getSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

export const LIFEOS_REALTIME_EVENTS = [
  "intervention.created",
  "life_score.updated",
  "goal_probability.updated",
  "assistant.rewarded",
] as const;

export type LifeOSRealtimeEvent = (typeof LIFEOS_REALTIME_EVENTS)[number];

export function getLifeOSRealtimeChannel(userId: string) {
  return `lifeos:${userId}`;
}

export function hasLifeOSRealtimeConfig() {
  return hasSupabaseServerConfig();
}

export async function broadcastLifeOSRealtimeEvent(userId: string, event: LifeOSRealtimeEvent, payload: Record<string, unknown>) {
  if (!hasLifeOSRealtimeConfig()) {
    return { sent: false, reason: "supabase_realtime_not_configured", channel: getLifeOSRealtimeChannel(userId), event };
  }

  const supabase = getSupabaseServerClient();
  const channel = supabase.channel(getLifeOSRealtimeChannel(userId));

  try {
    const result = await channel.send({
      type: "broadcast",
      event,
      payload,
    });

    return { sent: result === "ok", reason: result === "ok" ? "sent" : String(result), channel: getLifeOSRealtimeChannel(userId), event };
  } finally {
    await supabase.removeChannel(channel);
  }
}
