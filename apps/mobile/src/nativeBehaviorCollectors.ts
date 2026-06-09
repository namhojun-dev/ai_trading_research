import { Platform } from "react-native";
import type { MobileBehaviorSample } from "./lifeosApi";

type MobilePlatform = "android" | "ios";

export function getLifeOSMobilePlatform(): MobilePlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

export async function collectBehaviorSamples(): Promise<MobileBehaviorSample[]> {
  if (process.env.EXPO_PUBLIC_LIFEOS_DEMO_SYNC !== "true") {
    return [];
  }

  const capturedAt = new Date().toISOString();

  if (Platform.OS === "android") {
    return [
      {
        source: "usage_stats",
        metric: "app_usage_minutes",
        category: "youtube",
        appName: "YouTube",
        value: 12,
        unit: "minutes",
        capturedAt,
      },
      {
        source: "health_connect",
        metric: "steps",
        value: 1200,
        unit: "count",
        capturedAt,
      },
    ];
  }

  return [
    {
      source: "screen_time",
      metric: "app_usage_minutes",
      category: "sns",
      appName: "Instagram",
      value: 10,
      unit: "minutes",
      capturedAt,
    },
    {
      source: "healthkit",
      metric: "exercise_minutes",
      value: 15,
      unit: "minutes",
      capturedAt,
    },
  ];
}
