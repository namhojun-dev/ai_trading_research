import type { ScheduleBlock } from "@/features/lifeos/domain/entities";

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function todayAt(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour ?? 0, minute ?? 0, 0, 0);
  return date;
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function scheduleToIcs(schedule: ScheduleBlock[]) {
  const events = schedule.map((block) => {
    const start = todayAt(block.start);
    const end = todayAt(block.end);
    if (end <= start) end.setDate(end.getDate() + 1);

    return [
      "BEGIN:VEVENT",
      `UID:${block.id}@lifeos.ai`,
      `DTSTAMP:${stamp()}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escapeText(block.title)}`,
      `DESCRIPTION:${escapeText(`LifeOS intent: ${block.intent}`)}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LifeOS AI//Schedule//EN", ...events, "END:VCALENDAR"].join("\r\n");
}
