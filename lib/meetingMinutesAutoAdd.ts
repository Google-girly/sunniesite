// "When a budget is submitted it should automatically go with the next
// meeting, as long as it is not within 24 hrs and 5 min of the
// meeting" + the Letters page's "Add to Next Meeting Minutes" button
// for Letter of Excuse / Active Member Request (Aug 2026). Both funnel
// through here: find the next real Meeting more than 24h05m away right
// now, and drop a Meeting Note (Action Item) onto it — see
// lib/meetingNotes.ts for the note categories this reuses.
import { prisma } from "@/lib/prisma";
import { parseIsoDateLocal } from "@/lib/meetingMinutesExport";
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

// A meeting with no time on file is treated as happening at 11:59 PM
// that day — the most lenient reading, so a same-day submission isn't
// unfairly bumped just because nobody's set a time yet.
function meetingDateTime(meeting: Pick<Meeting, "date" | "time">): Date {
  const day = parseIsoDateLocal(meeting.date);
  const parsed = parseTimeOfDay(meeting.time);
  if (parsed) {
    day.setHours(parsed.hours, parsed.minutes, 0, 0);
  } else {
    day.setHours(23, 59, 0, 0);
  }
  return day;
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
