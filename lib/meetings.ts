// Recurring meeting schedule math — used by the Meetings page itself and
// by Budgets (Date Due / Date Presented default to "the next meeting").
//
// A MeetingSchedule is a *rule*, not a list of dates: "every other
// Sunday" rather than "Sept 7, Sept 21, Oct 5, ...". Computing "the next
// occurrence" needs an anchor date (a real date the series actually
// meets on) because "every other week" is ambiguous without one — the
// interval has to be counted from somewhere. All math is done in UTC so
// it's pure calendar-date arithmetic, unaffected by the server's local
// timezone or DST.

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface MeetingScheduleLike {
  dayOfWeek: number;
  intervalWeeks: number;
  anchorDate: string; // ISO "YYYY-MM-DD"
}

// Safety cap on how many Meeting rows one endDate can auto-generate
// (see lib/meetingGeneration.ts) — guards against a mistyped
// far-future end date trying to create hundreds of rows. 200 weekly
// meetings is ~4 years, well past any real use of this.
export const MAX_AUTO_GENERATED_MEETINGS = 200;

function parseIsoDateUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// The next date >= fromIso that this one schedule actually meets on.
export function nextOccurrence(schedule: MeetingScheduleLike, fromIso: string): string {
  const anchor = parseIsoDateUTC(schedule.anchorDate);
  const intervalDays = Math.max(1, schedule.intervalWeeks) * 7;

  // Move to the next date >= fromIso that falls on the right day of the
  // week (could be fromIso itself).
  const candidate = parseIsoDateUTC(fromIso);
  const diffToDay = (schedule.dayOfWeek - candidate.getUTCDay() + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + diffToDay);

  // Then step forward a week at a time (at most intervalWeeks steps)
  // until it lands on the same interval-weeks cycle as the anchor.
  for (let i = 0; i < schedule.intervalWeeks; i++) {
    const diffDays = Math.round((candidate.getTime() - anchor.getTime()) / 86_400_000);
    const mod = ((diffDays % intervalDays) + intervalDays) % intervalDays;
    if (mod === 0) return toIsoDateUTC(candidate);
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }
  return toIsoDateUTC(candidate);
}

// Every real date this one schedule meets on, from its first actual
// occurrence on/after anchorDate through endDate (inclusive) — the full
// list, not just "the next one." Powers auto-creating a Meeting row per
// occurrence once an end date is set (lib/meetingGeneration.ts).
// anchorDate itself isn't required to fall on `dayOfWeek` (nothing
// validates that when a schedule's created), so this starts from
// nextOccurrence() rather than assuming anchorDate is already a real
// meeting date, then steps forward in exact intervalWeeks jumps from
// there — once the first date is correctly on-cycle, every multiple of
// the interval after it is too.
export function allOccurrences(schedule: MeetingScheduleLike, endDateIso: string): string[] {
  const dates: string[] = [];
  let cursor = nextOccurrence(schedule, schedule.anchorDate);
  while (cursor <= endDateIso && dates.length < MAX_AUTO_GENERATED_MEETINGS) {
    dates.push(cursor);
    const next = parseIsoDateUTC(cursor);
    next.setUTCDate(next.getUTCDate() + Math.max(1, schedule.intervalWeeks) * 7);
    cursor = toIsoDateUTC(next);
  }
  return dates;
}

// The soonest upcoming meeting across every active schedule — e.g. if
// there's both a general body series and an exec board series, this is
// whichever of the two comes first. Null if there are no schedules at
// all (nothing to suggest).
export function nextMeetingDate(
  schedules: MeetingScheduleLike[],
  fromIso: string
): string | null {
  if (schedules.length === 0) return null;
  const dates = schedules.map((s) => nextOccurrence(s, fromIso));
  return dates.sort()[0]; // ISO date strings sort lexicographically = chronologically
}

// "19:00" -> "7:00 PM" — MeetingSchedule stores time as 24h "HH:MM"
// (display-only, doesn't affect date math); Meeting Minutes wants it in
// the same 12-hour format the real template's "Meeting Call to Order"
// field already uses.
export function formatTime12h(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  const hours24 = Number(match[1]);
  const minutes = match[2];
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
