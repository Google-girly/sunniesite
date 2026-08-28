// Shared Study Hours constants + math — used by both the API routes
// (validation) and the UI.
//
// Chapter Standards Approved 08-2026, §B.4/§B.6: Active and Inactive
// members must each complete a minimum of 6 documented study hours per
// week, and at minimum 80% of members (in each group) must complete
// every week of a term. The real "Study Hours" spreadsheet just logs
// individual sessions (Location/Date/Time In/Time Out/Total Time) — the
// weekly rollup used for reporting is computed here, not entered.

export const WEEKLY_HOURS_REQUIRED = 6;
export const WEEKLY_COMPLETION_THRESHOLD = 0.8; // 80% of members must complete every week

export interface StudyHourEntryLike {
  date: string; // ISO "YYYY-MM-DD"
  hours: number;
}

function parseIsoDateUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// The Monday (ISO week start) of whatever week `iso` falls in — used as
// a grouping key so "hours logged this week" isn't sensitive to which
// day of the week someone happens to study on.
export function weekStart(iso: string): string {
  const date = parseIsoDateUTC(iso);
  const day = date.getUTCDay(); // 0=Sunday..6=Saturday
  const offset = day === 0 ? -6 : 1 - day; // days back to Monday
  date.setUTCDate(date.getUTCDate() + offset);
  return toIsoDateUTC(date);
}

// Every Monday from `startIso`'s week through `endIso`'s week, inclusive
// — i.e. every week that overlaps the [start, end] range at all.
export function weeksInRange(startIso: string, endIso: string): string[] {
  const weeks: string[] = [];
  const cursor = parseIsoDateUTC(weekStart(startIso));
  const last = parseIsoDateUTC(weekStart(endIso));
  while (cursor.getTime() <= last.getTime()) {
    weeks.push(toIsoDateUTC(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks;
}

export interface WeeklyCompletion {
  weeksInTerm: number;
  weeksCompleted: number;
  percentage: number; // 0-100, rounded to whole percent
}

// Given a member's logged sessions and a term's [start, end] date range,
// how many of the term's weeks did she log >= 6 hours in? Entries
// outside the range are ignored, so a term boundary doesn't have to line
// up with when logging actually started/stopped.
export function calculateWeeklyCompletion(
  entries: StudyHourEntryLike[],
  termStart: string,
  termEnd: string
): WeeklyCompletion {
  const weeks = weeksInRange(termStart, termEnd);
  const totalsByWeek = new Map<string, number>();
  for (const entry of entries) {
    if (entry.date < termStart || entry.date > termEnd) continue;
    const key = weekStart(entry.date);
    totalsByWeek.set(key, (totalsByWeek.get(key) ?? 0) + entry.hours);
  }
  const weeksCompleted = weeks.filter(
    (w) => (totalsByWeek.get(w) ?? 0) >= WEEKLY_HOURS_REQUIRED
  ).length;
  const weeksInTerm = weeks.length;
  return {
    weeksInTerm,
    weeksCompleted,
    percentage: weeksInTerm > 0 ? Math.round((weeksCompleted / weeksInTerm) * 100) : 0,
  };
}

export function totalHours(entries: StudyHourEntryLike[]): number {
  return entries.reduce((sum, e) => sum + e.hours, 0);
}

// A rough current-term date range, matching lib/communityService.ts's
// currentTerm() month cutoffs — a starting guess the Vice President can
// always override (the Study Hours export form takes explicit term
// start/end dates), not a source of truth the app enforces anywhere.
export function currentTermRange(date: Date = new Date()): { start: string; end: string } {
  const month = date.getUTCMonth() + 1; // 1-12
  const year = date.getUTCFullYear();
  if (month <= 5) return { start: `${year}-01-01`, end: `${year}-05-31` };
  if (month <= 7) return { start: `${year}-06-01`, end: `${year}-07-31` };
  return { start: `${year}-08-01`, end: `${year}-12-31` };
}

export function currentTermLabel(date: Date = new Date()): string {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  if (month <= 5) return `Spring ${year}`;
  if (month <= 7) return `Summer ${year}`;
  return `Fall ${year}`;
}

export function formatStudyDate(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Which week of its own month a date falls in (1st-7th = Week 1,
// 8th-14th = Week 2, ...), so nobody has to work this out by hand when
// logging a session — purely a calendar computation from the date
// already being entered, not a value anyone types in.
export function weekOfMonth(iso: string): number {
  const match = /^\d{4}-\d{2}-(\d{2})$/.exec(iso);
  if (!match) return 1;
  const day = Number(match[1]);
  return Math.ceil(day / 7);
}
