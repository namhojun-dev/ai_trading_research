import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { normalizeMobileBehaviorSamples } from "@/features/lifeos/application/mobile-behavior-sync";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MobileBehaviorSampleSchema = z.object({
  source: z.enum(["usage_stats", "health_connect", "screen_time", "healthkit"]),
  metric: z.enum([
    "app_usage_minutes",
    "sleep_hours",
    "exercise_minutes",
    "study_minutes",
    "reading_minutes",
    "steps",
    "late_snack_count",
  ]),
  value: z.number().finite().nonnegative(),
  unit: z.enum(["seconds", "minutes", "hours", "count"]).optional(),
  category: z.enum(["sns", "game", "youtube", "study", "reading", "exercise", "sleep", "other"]).optional(),
  appName: z.string().min(1).max(120).optional(),
  capturedAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});

const MobileBehaviorSyncSchema = z.object({
  device: z
    .object({
      platform: z.enum(["android", "ios"]),
      deviceId: z.string().min(1).max(128).optional(),
      timezone: z.string().min(1).max(80).optional(),
    })
    .optional(),
  samples: z.array(MobileBehaviorSampleSchema).min(1).max(200),
});

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:mobile:behavior-sync", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = MobileBehaviorSyncSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mobile behavior sync payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const normalized = normalizeMobileBehaviorSamples(parsed.data.samples);
  if (normalized.logs.length === 0) {
    return NextResponse.json(
      {
        error: "No supported behavior samples found",
        accepted: 0,
        rejected: normalized.rejected,
      },
      { status: 400 },
    );
  }

  const service = getLifeOSService();
  const behaviorLogs = [];
  for (const log of normalized.logs) {
    behaviorLogs.push(await service.createBehaviorLog(log));
  }
  const snapshot = await service.getDashboardSnapshot();

  return NextResponse.json(
    {
      device: parsed.data.device ?? null,
      accepted: behaviorLogs.length,
      rejected: normalized.rejected,
      behaviorLogs,
      lifeScore: snapshot.lifeScore,
      probabilities: snapshot.probabilities,
      intervention: snapshot.intervention,
    },
    { status: 201 },
  );
}
