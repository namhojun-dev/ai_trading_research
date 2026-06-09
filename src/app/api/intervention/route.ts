import { NextRequest, NextResponse } from "next/server";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:intervention", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const snapshot = await getLifeOSService().getDashboardSnapshot();
  return NextResponse.json({
    intervention: snapshot.intervention,
  });
}
