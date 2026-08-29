// "Email the meeting minutes to Active sisters 24 hours before every
// meeting" (Aug 2026) — driven off MeetingSchedule (the recurring
// *rule*), not logged Meeting rows, since a Meeting row for tomorrow
// usually doesn't exist yet (those get logged around/after the meeting
// itself, via "+ Log a Meeting"). What actually gets sent is the most
// recently logged Meeting's minutes from *this same series* — the
// current meeting's own minutes obviously don't exist a day before it
// happens, so this is "review last time's minutes before you come," a
// real, common chapter practice, not a bug.
//
// This is meant to be driven by a daily cron job hitting
// app/api/cron/meeting-reminders (see vercel.json), not called from
// anywhere in the UI — Vercel's free (Hobby) tier only allows once-a-day
// cron schedules, so "24 hours before" here really means "the day
// before," checked once daily. A chapter that needs hour-precision
// timing would need a paid Vercel plan (more frequent cron) or a
// different scheduler entirely; flagged in MODULES.md.
import { prisma } from "@/lib/prisma";
import { nextOccurrence, formatTime12h } from "@/lib/meetings";
import { formatMeetingDate } from "@/lib/meetingMinutes";
import { buildMeetingMinutesDocx, meetingMinutesFilename } from "@/lib/meetingMinutesExport";
import { sendEmail } from "@/lib/email";
import { CHAPTER_FULL_NAME } from "@/lib/chapterConfig";
import type { Meeting, MeetingSchedule, OfficerReport } from "@/app/generated/prisma/client";

function todayIsoUTC(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function baseUrl(): string {
  // Set this to the app's real deployed URL (e.g.
  // "https://son-theta.vercel.app") — see .env.example. Falls back to a
  // placeholder rather than throwing, so a misconfigured deploy still
  // sends the reminder text/attachment, just with a dead link instead
  // of silently failing the whole thing.
  return process.env.APP_BASE_URL?.replace(/\/$/, "") || "https://your-app.vercel.app";
}

function buildReminderEmail(
  schedule: MeetingSchedule,
  meetingDate: string,
  lastMeeting: (Meeting & { officerReports: OfficerReport[] }) | null
): { subject: string; html: string; text: string } {
  const label = schedule.label || "Chapter Meeting";
  const when = formatMeetingDate(meetingDate) + (schedule.time ? ` at ${formatTime12h(schedule.time)}` : "");
  const subject = `Reminder: ${label} tomorrow (${formatMeetingDate(meetingDate)})`;

  const minutesLine = lastMeeting
    ? `Attached (and linked below) are the minutes from our last meeting (${formatMeetingDate(
        lastMeeting.date
      )}) — please review before you come.`
    : "There are no prior minutes on file yet for this meeting series.";
  // Links to the Minutes list (open to every logged-in member) rather
  // than a specific meeting's own page — that page is officer-only
  // (Aug 2026), and this reminder goes out to every Active member, most
  // of whom aren't officers.
  const minutesLink = lastMeeting ? `${baseUrl()}/meetings-reports/minutes` : null;

  const text = [
    `${label} is tomorrow: ${when}.`,
    "",
    minutesLine,
    minutesLink ? minutesLink : "",
    "",
    `— ${CHAPTER_FULL_NAME}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p><strong>${label}</strong> is tomorrow: ${when}.</p>
    <p>${minutesLine}</p>
    ${minutesLink ? `<p><a href="${minutesLink}">${minutesLink}</a></p>` : ""}
    <p>— ${CHAPTER_FULL_NAME}</p>
  `;

  return { subject, html, text };
}

export interface ReminderRunResult {
  scheduleId: string;
  label: string | null;
  meetingDate: string;
  sent: boolean;
  reason?: string;
  recipientCount?: number;
}

// The function the cron route calls. Safe to call more than once for
// the same day — MeetingReminderLog's unique (scheduleId, meetingDate)
// constraint means a second run just reports each schedule as already
// sent rather than emailing twice.
export async function sendMeetingRemindersDueTomorrow(): Promise<ReminderRunResult[]> {
  const tomorrow = addDaysIso(todayIsoUTC(), 1);

  const schedules = await prisma.meetingSchedule.findMany({ where: { active: true } });
  const dueTomorrow = schedules.filter((s) => nextOccurrence(s, tomorrow) === tomorrow);
  if (dueTomorrow.length === 0) return [];

  const activeMembers = await prisma.member.findMany({
    where: { status: "ACTIVE", email: { not: null } },
  });
  const recipients = activeMembers.map((m) => m.email).filter((e): e is string => Boolean(e));

  const results: ReminderRunResult[] = [];

  for (const schedule of dueTomorrow) {
    const already = await prisma.meetingReminderLog.findUnique({
      where: { scheduleId_meetingDate: { scheduleId: schedule.id, meetingDate: tomorrow } },
    });
    if (already) {
      results.push({ scheduleId: schedule.id, label: schedule.label, meetingDate: tomorrow, sent: false, reason: "already sent" });
      continue;
    }
    if (recipients.length === 0) {
      // Not logged — if an email address gets added later today, a
      // re-run of this same cron day could still catch it.
      results.push({ scheduleId: schedule.id, label: schedule.label, meetingDate: tomorrow, sent: false, reason: "no Active members with an email on file" });
      continue;
    }

    const lastMeeting = await prisma.meeting.findFirst({
      where: { scheduleId: schedule.id, date: { lt: tomorrow } },
      orderBy: { date: "desc" },
      include: { officerReports: true, notes: true },
    });

    const { subject, html, text } = buildReminderEmail(schedule, tomorrow, lastMeeting);

    let attachments: { filename: string; content: Uint8Array }[] | undefined;
    if (lastMeeting) {
      const members = await prisma.member.findMany({ select: { name: true, role: true, status: true, email: true } });
      const bytes = await buildMeetingMinutesDocx(lastMeeting, lastMeeting.officerReports, members, lastMeeting.notes);
      attachments = [{ filename: meetingMinutesFilename(lastMeeting), content: bytes }];
    }

    await sendEmail({ to: recipients, subject, html, text, attachments });

    await prisma.meetingReminderLog.create({
      data: { scheduleId: schedule.id, meetingDate: tomorrow, recipientCount: recipients.length },
    });

    results.push({
      scheduleId: schedule.id,
      label: schedule.label,
      meetingDate: tomorrow,
      sent: true,
      recipientCount: recipients.length,
    });
  }

  return results;
}
