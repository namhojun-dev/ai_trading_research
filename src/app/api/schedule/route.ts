import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ScheduleSchema = z.object({
  workStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sleepStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sleepEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function GET() {
  const snapshot = await getLifeOSService().getDashboardSnapshot();
  return NextResponse.json({ schedule: snapshot.schedule });
}

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:schedule:create", { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const json = await req.json().catch(() => ({}));
  const parsed = ScheduleSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid schedule payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const snapshot = await getLifeOSService().getDashboardSnapshot(parsed.data);
  return NextResponse.json({ schedule: snapshot.schedule });
}
