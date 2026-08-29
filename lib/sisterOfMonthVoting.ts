import { SISTER_OF_MONTH_MONTHS, type SisterOfMonthMonth } from "@/lib/standardsForms";
import { prisma } from "@/lib/prisma";
import { allOccurrences } from "@/lib/meetings";

// Aug 2026 rework: "due date should be prior to the first meeting of
// every month for sister of the month for the month prior. Example
// September 7th should be where the sister of the month for august is
// announced." The fixed D10 credit row list (SISTER_OF_MONTH_MONTHS,
// Sept-June — see lib/standardsForms.ts) already matches this: the
// "September" row IS the one announced at September's first meeting,
// which is exactly when the general membership finds out who won for
// August — there's no separate "August" row needed. So each row's
// voting deadline (`dueDate`) is simply that row's own named month's
// first scheduled meeting date, and the ballot for that row is what's
// open in the run-up to it (naturally covering the prior calendar
// month, without needing to special-case it).
//
// Deadlines come from the real meeting schedule now (a sorted list of
// every known/projected Meeting date, ISO "YYYY-MM-DD") rather than a
// pure calendar pass-through — see app/api/standards/sister-of-month/vote
// for how that list gets built (MeetingSchedule projections + any
// logged Meeting rows) and passed in here.

const MONTH_CALENDAR_INDEX: Record<SisterOfMonthMonth, number> = {
  September: 8,
  October: 9,
  November: 10,
  December: 11,
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
};

export interface VotingPeriod {
  year: number; // calendar year of this row's OWN month (the September row's own September, etc.)
  month: SisterOfMonthMonth;
  dueDate: string | null; // ISO date of that month's first scheduled meeting — null if none scheduled (yet)
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIsoUTC(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// `dates` must be sorted ascending. Earliest date that falls within the
// given calendar year/month (monthIndex0 is 0-based, JS Date style).
function firstMeetingInMonth(dates: string[], year: number, monthIndex0: number): string | null {
  const prefix = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
  const match = dates.find((d) => d.startsWith(prefix));
  return match ?? null;
}

// September through June (SISTER_OF_MONTH_MONTHS' own order) — Sept-Dec
// keep the academic year's start calendar year, Jan-June roll into the
// following calendar year. Both fixed-calendar concepts, always true
// regardless of when this is called.
function rowYear(month: SisterOfMonthMonth, academicStartYear: number): number {
  return MONTH_CALENDAR_INDEX[month] >= 8 ? academicStartYear : academicStartYear + 1;
}

// The ballot currently open, or null if nothing qualifies (no chapter
// meetings scheduled at all, ever — a fresh install with no
// MeetingSchedule yet). `meetingDates` sorted ascending ISO, from every
// active MeetingSchedule's projected occurrences plus any already-
// logged Meeting rows (see the vote route). `confirmedKeys` is every
// (year, month) already locked into SisterOfTheMonth, as `"year-month"`
// strings, so an already-decided row never gets reopened.
export function currentVotingPeriod(
  meetingDates: string[],
  confirmedKeys: Set<string>,
  from: Date = new Date()
): VotingPeriod | null {
  const todayIso = todayIsoUTC(from);
  const currentAcademicStartYear = from.getMonth() >= 8 ? from.getFullYear() : from.getFullYear() - 1;

  // A ~3-academic-year window (last year's stragglers through next
  // year) is generous enough to always contain "the next upcoming
  // deadline" without walking forward forever.
  const candidates: VotingPeriod[] = [];
  for (let yOffset = -1; yOffset <= 1; yOffset++) {
    const academicStartYear = currentAcademicStartYear + yOffset;
    for (const month of SISTER_OF_MONTH_MONTHS) {
      const year = rowYear(month, academicStartYear);
      const dueDate = firstMeetingInMonth(meetingDates, year, MONTH_CALENDAR_INDEX[month]);
      candidates.push({ year, month, dueDate });
    }
  }

  // "In play": has a real scheduled deadline, isn't already confirmed,
  // and that deadline hasn't been passed for more than ~60 days (a
  // grace window so a just-missed deadline still shows rather than
  // silently vanishing, without getting stuck reconciling old history
  // on a fresh install). Soonest deadline wins.
  const graceFloor = addDaysIso(todayIso, -60);
  const inPlay = candidates
    .filter((c) => c.dueDate && c.dueDate >= graceFloor && !confirmedKeys.has(`${c.year}-${c.month}`))
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
  if (inPlay.length > 0) return inPlay[0];

  // No meeting schedule to derive a real deadline from yet — fall back
  // to "whichever academic month it is right now" (no due date shown)
  // so the ballot still works before a MeetingSchedule exists. null
  // during July/August, off-season.
  const fallbackMonth = SISTER_OF_MONTH_MONTHS.find((m) => MONTH_CALENDAR_INDEX[m] === from.getMonth());
  if (!fallbackMonth) return null;
  const year = rowYear(fallbackMonth, currentAcademicStartYear);
  if (confirmedKeys.has(`${year}-${fallbackMonth}`)) return null;
  return { year, month: fallbackMonth, dueDate: null };
}

function addDaysIsoUTC(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The DB-touching half of currentVotingPeriod above — gathers every
// known meeting date (each active MeetingSchedule's projected
// occurrences ~14 months out, generous enough to always reach "the next
// first-meeting-of-the-month," plus any already-logged Meeting rows)
// and every (year, month) already confirmed in SisterOfTheMonth, then
// hands off to the pure function. Shared by
// app/api/standards/sister-of-month/vote (the live ballot) and
// lib/toDoList.ts (the Dashboard to-do item), so both agree on exactly
// the same "what's open right now."
export async function resolveCurrentVotingPeriod(): Promise<VotingPeriod | null> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const horizon = addDaysIsoUTC(todayIso, 420);
  const [schedules, loggedMeetings, decided] = await Promise.all([
    prisma.meetingSchedule.findMany({ where: { active: true } }),
    prisma.meeting.findMany({ select: { date: true } }),
    prisma.sisterOfTheMonth.findMany({ select: { year: true, month: true } }),
  ]);

  const dateSet = new Set<string>(loggedMeetings.map((m) => m.date));
  for (const schedule of schedules) {
    for (const date of allOccurrences(schedule, horizon)) dateSet.add(date);
  }
  const meetingDates = [...dateSet].sort();
  const confirmedKeys = new Set(decided.map((d) => `${d.year}-${d.month}`));

  return currentVotingPeriod(meetingDates, confirmedKeys);
}
