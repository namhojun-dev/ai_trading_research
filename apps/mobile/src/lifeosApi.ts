export type LifeScorePayload = {
  lifeScore?: {
    today: number;
    week: number;
    month: number;
  };
  goals?: Array<{ id: string; title: string }>;
};

export type MobileBehaviorSample = {
  source: "usage_stats" | "health_connect" | "screen_time" | "healthkit";
  metric:
    | "app_usage_minutes"
    | "sleep_hours"
    | "exercise_minutes"
    | "study_minutes"
    | "reading_minutes"
    | "steps"
    | "late_snack_count";
  value: number;
  unit?: "seconds" | "minutes" | "hours" | "count";
  category?: "sns" | "game" | "youtube" | "study" | "reading" | "exercise" | "sleep" | "other";
  appName?: string;
  capturedAt?: string;
  startedAt?: string;
  endedAt?: string;
};

export type MobileBehaviorSyncResult = {
  accepted: number;
  rejected: Array<{ index: number; reason: string }>;
  lifeScore?: LifeScorePayload["lifeScore"];
};

export const apiBaseUrl = process.env.EXPO_PUBLIC_LIFEOS_API_BASE_URL ?? "http://127.0.0.1:3200";

export async function fetchLifeScore() {
  const response = await fetch(`${apiBaseUrl}/api/life-score`);
  if (!response.ok) throw new Error(`LifeOS API failed with ${response.status}`);
  return (await response.json()) as LifeScorePayload;
}

export async function syncBehaviorSamples(samples: MobileBehaviorSample[], platform: "android" | "ios") {
  const response = await fetch(`${apiBaseUrl}/api/mobile/behavior-sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      device: {
        platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      samples,
    }),
  });

  if (!response.ok) throw new Error(`Behavior sync failed with ${response.status}`);
  return (await response.json()) as MobileBehaviorSyncResult;
}
