import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { scheduleToIcs } from "@/lib/calendar/ics";
import type { ScheduleBlock } from "@/features/lifeos/domain/entities";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CalendarSyncSchema = z.object({
  provider: z.enum(["google", "apple"]),
  accessToken: z.string().min(1).optional(),
  calendarId: z.string().min(1).optional(),
});

function toGoogleEvent(block: ScheduleBlock) {
  const today = new Date();
  const date = today.toISOString().slice(0, 10);

  return {
    summary: block.title,
    description: `LifeOS AI schedule block. Intent: ${block.intent}`,
    start: {
      dateTime: `${date}T${block.start}:00+09:00`,
      timeZone: "Asia/Seoul",
    },
    end: {
      dateTime: `${date}T${block.end}:00+09:00`,
      timeZone: "Asia/Seoul",
    },
    extendedProperties: {
      private: {
        source: "lifeos-ai",
        intent: block.intent,
        goalId: block.goalId ?? "",
      },
    },
  };
}

async function insertGoogleEvents(accessToken: string, calendarId: string, blocks: ScheduleBlock[]) {
  const encodedCalendarId = encodeURIComponent(calendarId);
  const results = await Promise.allSettled(
    blocks.map(async (block) => {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toGoogleEvent(block)),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Google Calendar insert failed: ${response.status} ${JSON.stringify(body)}`);
      }

      return body as { id?: string; htmlLink?: string };
    }),
  );

  return {
    inserted: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
    events: results
      .filter((result): result is PromiseFulfilledResult<{ id?: string; htmlLink?: string }> => result.status === "fulfilled")
      .map((result) => result.value),
  };
}

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:calendar:sync", { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = CalendarSyncSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid calendar sync payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const snapshot = await getLifeOSService().getDashboardSnapshot();
  const ics = scheduleToIcs(snapshot.schedule);

  if (parsed.data.provider === "apple") {
    return NextResponse.json(
      {
        error: "Apple Calendar direct write requires CalDAV credentials or user-side ICS import",
        provider: "apple",
        ics,
      },
      { status: 501 },
    );
  }

  if (!parsed.data.accessToken || !parsed.data.calendarId) {
    return NextResponse.json(
      {
        error: "Google Calendar sync requires accessToken and calendarId",
        provider: "google",
        ics,
      },
      { status: 501 },
    );
  }

  const sync = await insertGoogleEvents(parsed.data.accessToken, parsed.data.calendarId, snapshot.schedule);

  if (sync.inserted === 0) {
    return NextResponse.json(
      {
        error: "Google Calendar write failed",
        provider: "google",
        calendarId: parsed.data.calendarId,
        sync,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    provider: "google",
    calendarId: parsed.data.calendarId,
    sync,
  });
}
