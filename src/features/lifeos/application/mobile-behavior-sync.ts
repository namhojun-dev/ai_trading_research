import type { BehaviorSource, BehaviorType, CreateBehaviorLogInput } from "../domain/entities";

export type MobilePlatform = "android" | "ios";

export type MobileBehaviorMetric =
  | "app_usage_minutes"
  | "sleep_hours"
  | "exercise_minutes"
  | "study_minutes"
  | "reading_minutes"
  | "steps"
  | "late_snack_count";

export type MobileBehaviorUnit = "seconds" | "minutes" | "hours" | "count";

export type MobileBehaviorCategory = "sns" | "game" | "youtube" | "study" | "reading" | "exercise" | "sleep" | "other";

export interface MobileBehaviorSample {
  source: Extract<BehaviorSource, "usage_stats" | "health_connect" | "screen_time" | "healthkit">;
  metric: MobileBehaviorMetric;
  value: number;
  unit?: MobileBehaviorUnit;
  category?: MobileBehaviorCategory;
  appName?: string;
  capturedAt?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface RejectedMobileBehaviorSample {
  index: number;
  reason: string;
  sample: MobileBehaviorSample;
}

const APP_CATEGORY_PATTERNS: Array<{ type: BehaviorType; pattern: RegExp }> = [
  { type: "youtube_minutes", pattern: /\b(youtube|yt music|shorts)\b/i },
  { type: "sns_minutes", pattern: /\b(instagram|tiktok|threads|facebook|twitter|x|reddit|kakao|line|discord|telegram)\b/i },
  { type: "game_minutes", pattern: /\b(game|steam|roblox|minecraft|brawl|league of legends|lol|genshin|pubg)\b/i },
];

function minutes(value: number, unit: MobileBehaviorUnit | undefined) {
  if (unit === "seconds") return value / 60;
  if (unit === "hours") return value * 60;
  return value;
}

function hours(value: number, unit: MobileBehaviorUnit | undefined) {
  if (unit === "seconds") return value / 3600;
  if (unit === "minutes") return value / 60;
  return value;
}

function count(value: number) {
  return Math.round(value);
}

function sourceSupportsMetric(source: MobileBehaviorSample["source"], metric: MobileBehaviorMetric) {
  if (source === "usage_stats" || source === "screen_time") {
    return metric === "app_usage_minutes" || metric === "study_minutes" || metric === "reading_minutes";
  }
  return metric === "sleep_hours" || metric === "exercise_minutes" || metric === "steps" || metric === "late_snack_count";
}

function behaviorTypeForAppUsage(sample: MobileBehaviorSample): BehaviorType | null {
  if (sample.category === "youtube") return "youtube_minutes";
  if (sample.category === "sns") return "sns_minutes";
  if (sample.category === "game") return "game_minutes";
  if (sample.category === "study") return "study_minutes";
  if (sample.category === "reading") return "reading_minutes";

  const appName = sample.appName?.trim();
  if (!appName) return null;

  return APP_CATEGORY_PATTERNS.find((item) => item.pattern.test(appName))?.type ?? null;
}

function mapSampleToBehavior(sample: MobileBehaviorSample): { type: BehaviorType; value: number } | null {
  if (!sourceSupportsMetric(sample.source, sample.metric)) return null;

  switch (sample.metric) {
    case "app_usage_minutes": {
      const type = behaviorTypeForAppUsage(sample);
      return type ? { type, value: minutes(sample.value, sample.unit) } : null;
    }
    case "sleep_hours":
      return { type: "sleep_hours", value: hours(sample.value, sample.unit) };
    case "exercise_minutes":
      return { type: "exercise_minutes", value: minutes(sample.value, sample.unit) };
    case "study_minutes":
      return { type: "study_minutes", value: minutes(sample.value, sample.unit) };
    case "reading_minutes":
      return { type: "reading_minutes", value: minutes(sample.value, sample.unit) };
    case "steps":
      return { type: "steps", value: count(sample.value) };
    case "late_snack_count":
      return { type: "late_snack_count", value: count(sample.value) };
  }
}

export function normalizeMobileBehaviorSamples(samples: MobileBehaviorSample[], now = new Date()) {
  const rejected: RejectedMobileBehaviorSample[] = [];
  const logs: CreateBehaviorLogInput[] = [];

  samples.forEach((sample, index) => {
    const mapped = mapSampleToBehavior(sample);
    if (!mapped) {
      rejected.push({ index, reason: "unsupported_source_metric_or_category", sample });
      return;
    }

    if (!Number.isFinite(mapped.value) || mapped.value < 0) {
      rejected.push({ index, reason: "invalid_value", sample });
      return;
    }

    logs.push({
      type: mapped.type,
      value: Number(mapped.value.toFixed(2)),
      source: sample.source,
      createdAt: sample.endedAt ?? sample.capturedAt ?? now.toISOString(),
    });
  });

  return { logs, rejected };
}
