import { NextResponse } from "next/server";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { getLifeOSRealtimeChannel, hasLifeOSRealtimeConfig, LIFEOS_REALTIME_EVENTS } from "@/lib/realtime/lifeos-realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getLifeOSService().getDashboardSnapshot();

  return NextResponse.json({
    configured: hasLifeOSRealtimeConfig(),
    provider: "supabase",
    channel: getLifeOSRealtimeChannel(snapshot.user.id),
    events: LIFEOS_REALTIME_EVENTS,
  });
}
