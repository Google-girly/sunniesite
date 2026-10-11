// "When a budget is submitted it should automatically go with the next
// meeting, as long as it is not within 24 hrs and 5 min of the
// meeting" + the Letters page's "Add to Next Meeting Minutes" button
// for Letter of Excuse / Active Member Request (Aug 2026). Both funnel
// through here: find the next real Meeting more than 24h05m away right
// now, and drop a Meeting Note (Action Item) onto it — see
// lib/meetingNotes.ts for the note categories this reuses.
import { prisma } from "@/lib/prisma";
import { CHAPTER_CALENDAR_TIMEZONE } from "@/lib/calendar";
import type { Meeting } from "@/app/generated/prisma/client";

export const MINUTES_ADD_CUTOFF_MS = (24 * 60 + 5) * 60 * 1000; // 24h 5m

// Meeting.time is free text (whatever was typed into "New Meeting"'s
// Time field, or auto-formatted from a MeetingSchedule via
// lib/meetings.ts formatTime12h — either way, normally "H:MM AM/PM").
// Lenient on purpose: anything that doesn't parse just falls through to
// the "no time on file" branch below rather than throwing.
function parseTimeOfDay(time: string | null): { hours: number; minutes: number } | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(time.trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

// How far `tz`'s wall clock is ahead of UTC at `date`, in ms (negative
// for Pacific). Intl handles the PDT/PST switch.
function timeZoneOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// The real instant a chapter-local date + time happens.
function chapterLocalToInstant(year: number, month: number, day: number, hours: number, minutes: number): Date {
  const naive = Date.UTC(year, month - 1, day, hours, minutes);
  const offset = timeZoneOffsetMs(new Date(naive), CHAPTER_CALENDAR_TIMEZONE);
  let instant = naive - offset;
  // Re-check once in case `naive` and the answer straddle a DST switch.
  const corrected = timeZoneOffsetMs(new Date(instant), CHAPTER_CALENDAR_TIMEZONE);
  if (corrected !== offset) instant = naive - corrected;
  return new Date(instant);
}

// A meeting with no time on file is treated as happening at 11:59 PM
// that day — the most lenient reading, so a same-day submission isn't
// unfairly bumped just because nobody's set a time yet.
//
// Oct 2026 fix — "7:00 PM" means 7:00 PM *chapter* time (Pacific). This
// used to build the Date in the server's own timezone, and Vercel runs
// in UTC, so a 7 PM meeting was treated as noon Pacific: anything
// submitted in the ~7 hours before the real 24h05m cutoff got bumped to
// the following week's meeting.
function meetingDateTime(meeting: Pick<Meeting, "date" | "time">): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(meeting.date);
  if (!match) return new Date(meeting.date);
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = parseTimeOfDay(meeting.time) ?? { hours: 23, minutes: 59 };
  return chapterLocalToInstant(year, month, day, parsed.hours, parsed.minutes);
}

// The Meeting this should land on: the soonest upcoming one that's
// still more than 24h05m away right now. A meeting inside that window
// is too close to compile in time, so it rolls to the one after it —
// same rule for budgets and letters alike.
export async function findTargetMeetingForAutoAdd(now: Date = new Date()): Promise<Meeting | null> {
  const meetings = await prisma.meeting.findMany({ orderBy: { date: "asc" } });
  const future = meetings
    .map((m) => ({ meeting: m, at: meetingDateTime(m) }))
    .filter((m) => m.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const eligible = future.find((m) => m.at.getTime() - now.getTime() > MINUTES_ADD_CUTOFF_MS);
  return eligible?.meeting ?? null;
}

export interface AutoAddResult {
  meetingId: string;
  meetingDate: string;
}

// Creates the Action Item note on whichever meeting qualifies — null if
// there's no upcoming meeting far enough out (nothing logged yet, or
// every logged meeting is inside the cutoff).
export async function addActionItemToNextMeeting(
  text: string,
  author: { id: string | null; name: string },
  now: Date = new Date()
): Promise<AutoAddResult | null> {
  const meeting = await findTargetMeetingForAutoAdd(now);
  if (!meeting) return null;

  await prisma.meetingNote.create({
    data: {
      meetingId: meeting.id,
      category: "ACTION_ITEM",
      text,
      authorMemberId: author.id,
      authorName: author.name,
    },
  });

  return { meetingId: meeting.id, meetingDate: meeting.date };
}
