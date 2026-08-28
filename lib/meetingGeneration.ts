// Auto-creates the Meeting (minutes) rows for a schedule's own end date
// (Aug 2026) — see app/api/meetings for where this gets called (after
// both creating and editing a MeetingSchedule). Server-only (touches
// prisma), separate from lib/meetings.ts's pure date math so that file
// can stay safe to import from a Client Component.
import { prisma } from "@/lib/prisma";
import { allOccurrences, formatTime12h } from "@/lib/meetings";

export interface GenerationSchedule {
  id: string;
  dayOfWeek: number;
  intervalWeeks: number;
  anchorDate: string;
  endDate: string | null;
  time: string | null;
}

// Additive only — never deletes or touches an existing Meeting (it
// might already have real Officer Reports on it), even if the
// schedule's own pattern (day/interval/anchor) changed since a given
// occurrence was generated. Safe to call repeatedly (e.g. every time
// the schedule is edited): only ever fills in whatever's still missing
// between anchorDate and endDate. Returns how many were created.
export async function fillMissingMeetings(schedule: GenerationSchedule): Promise<number> {
  if (!schedule.endDate) return 0;

  const occurrences = allOccurrences(schedule, schedule.endDate);
  if (occurrences.length === 0) return 0;

  const existing = await prisma.meeting.findMany({
    where: { scheduleId: schedule.id, date: { in: occurrences } },
    select: { date: true },
  });
  const existingDates = new Set(existing.map((m) => m.date));
  const missing = occurrences.filter((date) => !existingDates.has(date));
  if (missing.length === 0) return 0;

  await prisma.meeting.createMany({
    data: missing.map((date) => ({
      date,
      time: schedule.time ? formatTime12h(schedule.time) : null,
      scheduleId: schedule.id,
    })),
  });

  return missing.length;
}
