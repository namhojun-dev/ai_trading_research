import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BehaviorLogSchema = z.object({
  type: z.enum([
    "exercise_minutes",
    "sleep_hours",
    "study_minutes",
    "reading_minutes",
    "sns_minutes",
    "game_minutes",
    "youtube_minutes",
    "steps",
    "late_snack_count",
  ]),
  value: z.number().finite().nonnegative(),
  source: z.enum(["manual", "usage_stats", "health_connect", "screen_time", "healthkit", "calendar"]),
  createdAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:behavior-log:create", { limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = BehaviorLogSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid behavior log payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const behaviorLog = await getLifeOSService().createBehaviorLog(parsed.data);
  const snapshot = await getLifeOSService().getDashboardSnapshot();

  return NextResponse.json(
    {
      behaviorLog,
      lifeScore: snapshot.lifeScore,
      probabilities: snapshot.probabilities,
      intervention: snapshot.intervention,
    },
    { status: 201 },
  );
}
