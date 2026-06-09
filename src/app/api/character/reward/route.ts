import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RewardSchema = z.object({
  experience: z.number().finite().min(1).max(5000),
  title: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:character:reward", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = RewardSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reward payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await getLifeOSService().awardAssistantExperience(parsed.data.experience, parsed.data.title);
  return NextResponse.json(result);
}
