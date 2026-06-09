import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { LifeOSEntitlementError } from "@/features/lifeos/application/lifeos-service";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateGoalSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().min(2).max(400),
  deadline: z.string().datetime().or(z.string().date()),
  priority: z.enum(["low", "medium", "high"]),
});

export async function GET() {
  const snapshot = await getLifeOSService().getDashboardSnapshot();
  return NextResponse.json({
    goals: snapshot.goals,
    probabilities: snapshot.probabilities,
  });
}

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:goal:create", { limit: 12, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const json = await req.json().catch(() => null);
  const parsed = CreateGoalSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid goal payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  let goal;
  try {
    goal = await getLifeOSService().createGoal({
      ...parsed.data,
      deadline: new Date(parsed.data.deadline).toISOString(),
    });
  } catch (error) {
    if (error instanceof LifeOSEntitlementError) {
      return NextResponse.json({ error: error.message, upgradeRequired: true }, { status: 402 });
    }
    throw error;
  }

  return NextResponse.json({ goal }, { status: 201 });
}
