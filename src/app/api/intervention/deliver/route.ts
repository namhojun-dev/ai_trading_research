import { NextRequest, NextResponse } from "next/server";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { logLifeOSEvent } from "@/lib/logging/lifeos-logger";
import { sendInterventionPush } from "@/lib/push/intervention-push";
import { broadcastLifeOSRealtimeEvent } from "@/lib/realtime/lifeos-realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:intervention:deliver", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const service = getLifeOSService();
  const [snapshot, tokens] = await Promise.all([service.getDashboardSnapshot(), service.listPushTokens()]);
  const delivery = await sendInterventionPush(snapshot.user, snapshot.intervention, tokens);

  let notification = null;
  if (snapshot.intervention.shouldSend) {
    notification = await service.createNotification({
      title: snapshot.intervention.title,
      message: snapshot.intervention.message,
      sentAt: delivery.delivered ? new Date().toISOString() : null,
    });
  }
  const realtime = await broadcastLifeOSRealtimeEvent(snapshot.user.id, "intervention.created", {
    intervention: snapshot.intervention,
    notification,
  });

  logLifeOSEvent(delivery.delivered ? "info" : "warn", "lifeos:intervention:deliver", "Intervention delivery evaluated", {
    delivered: delivery.delivered,
    reason: delivery.reason,
    attemptedTokens: delivery.attemptedTokens,
    failedTokens: delivery.failedTokens,
    realtimeSent: realtime.sent,
  });

  return NextResponse.json({
    intervention: snapshot.intervention,
    delivery,
    realtime,
    notification,
  });
}
