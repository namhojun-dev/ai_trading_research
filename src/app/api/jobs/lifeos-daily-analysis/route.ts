import { NextRequest, NextResponse } from "next/server";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { logLifeOSEvent } from "@/lib/logging/lifeos-logger";
import { sendInterventionPush } from "@/lib/push/intervention-push";
import { broadcastLifeOSRealtimeEvent } from "@/lib/realtime/lifeos-realtime";
import { verifyCronRequest } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cron = verifyCronRequest(req);
  if (!cron.ok) {
    return NextResponse.json({ error: cron.error }, { status: cron.status });
  }

  const service = getLifeOSService();
  const [snapshot, tokens] = await Promise.all([service.getDashboardSnapshot(), service.listPushTokens()]);
  const delivery = await sendInterventionPush(snapshot.user, snapshot.intervention, tokens);
  const realtime = await broadcastLifeOSRealtimeEvent(snapshot.user.id, "life_score.updated", {
    lifeScore: snapshot.lifeScore,
    probabilities: snapshot.probabilities,
    intervention: snapshot.intervention,
  });

  let notification = null;
  if (snapshot.intervention.shouldSend) {
    notification = await service.createNotification({
      title: snapshot.intervention.title,
      message: snapshot.intervention.message,
      sentAt: delivery.delivered ? new Date().toISOString() : null,
    });
  }

  logLifeOSEvent("info", "lifeos:jobs:daily-analysis", "Daily LifeOS analysis completed", {
    score: snapshot.lifeScore.today,
    goals: snapshot.goals.length,
    intervention: snapshot.intervention.shouldSend,
    delivery: delivery.reason ?? "sent",
    realtime: realtime.reason,
  });

  return NextResponse.json({
    ok: true,
    lifeScore: snapshot.lifeScore,
    probabilities: snapshot.probabilities,
    interferences: snapshot.interferences,
    intervention: snapshot.intervention,
    delivery,
    realtime,
    notification,
  });
}
