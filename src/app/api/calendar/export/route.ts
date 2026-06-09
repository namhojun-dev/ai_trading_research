import { NextResponse } from "next/server";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { scheduleToIcs } from "@/lib/calendar/ics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getLifeOSService().getDashboardSnapshot();
  const ics = scheduleToIcs(snapshot.schedule);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lifeos-schedule.ics"',
      "Cache-Control": "no-store",
    },
  });
}
