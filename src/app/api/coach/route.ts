import { NextRequest, NextResponse } from "next/server";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { generateAICoaching } from "@/lib/ai/lifeos-coach";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:coach", { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const snapshot = await getLifeOSService().getDashboardSnapshot();
  const coach = await generateAICoaching(snapshot);
  return NextResponse.json(coach);
}
