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

export interface PruneResult {
  /** How many empty meetings after the end date were deleted. */
  removed: number;
  /** Dates of meetings after the end date that were kept because something is on them. */
  keptDates: string[];
}

// The other half of the end date (Nov 2026 — "I put an end date of
// 11/09/2026, so everything after that should not exist"): when a
// series' end date moves earlier, meetings it had already generated
// past the new end date are removed — but only empty ones. A meeting
// with anything on it (an Officer Report, note, attachment, uploaded
// final minutes, or a budget/letter auto-added to it) is kept and
// reported back, so nobody's work silently disappears; those can be
// moved off or removed by hand from the series page.
export async function pruneMeetingsAfterEndDate(schedule: GenerationSchedule): Promise<PruneResult> {
  if (!schedule.endDate) return { removed: 0, keptDates: [] };

  const pastEnd = await prisma.meeting.findMany({
    where: { scheduleId: schedule.id, date: { gt: schedule.endDate } },
    select: {
      id: true,
      date: true,
      finalMinutes: { select: { id: true } },
      _count: { select: { officerReports: true, notes: true, attachments: true } },
    },
  });
  if (pastEnd.length === 0) return { removed: 0, keptDates: [] };

  const ids = pastEnd.map((m) => m.id);
  const [budgets, letters] = await Promise.all([
    prisma.budget.findMany({ where: { addedToMeetingId: { in: ids } }, select: { addedToMeetingId: true } }),
    prisma.letter.findMany({ where: { addedToMeetingId: { in: ids } }, select: { addedToMeetingId: true } }),
  ]);
  const linked = new Set([...budgets, ...letters].map((r) => r.addedToMeetingId));

  const hasContent = (m: (typeof pastEnd)[number]) =>
    Boolean(m.finalMinutes) ||
    m._count.officerReports > 0 ||
    m._count.notes > 0 ||
    m._count.attachments > 0 ||
    linked.has(m.id);

  const emptyIds = pastEnd.filter((m) => !hasContent(m)).map((m) => m.id);
  const keptDates = pastEnd.filter(hasContent).map((m) => m.date).sort();
  if (emptyIds.length > 0) {
    await prisma.meeting.deleteMany({ where: { id: { in: emptyIds } } });
  }
  return { removed: emptyIds.length, keptDates };
}
