import { NextResponse } from "next/server";
import { getLifeOSService } from "@/features/lifeos/application/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getLifeOSService().getDashboardSnapshot();

  return NextResponse.json({
    lifeScore: snapshot.lifeScore,
    goals: snapshot.goals,
    probabilities: snapshot.probabilities,
    schedule: snapshot.schedule,
    assistant: snapshot.assistant,
    coach: snapshot.coach,
    interferences: snapshot.interferences,
    intervention: snapshot.intervention,
  }, {
    headers: {
      "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
    },
  });
}
