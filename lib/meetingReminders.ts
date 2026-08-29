// "Email the meeting minutes to Active sisters 24 hours before every
// meeting" (Aug 2026, reworked Aug 2026) — driven off MeetingSchedule
// (the recurring *rule*) to find which series has a meeting tomorrow,
// then sends *that* meeting's own minutes, as filled in so far —
// officers submit their Officer Reports against the upcoming meeting
// all week (see the Dashboard to-do list), not after the fact, and
// Meeting rows themselves auto-generate ahead of time for a whole term
// (lib/meetingGeneration.ts), so tomorrow's Meeting record (and
// whatever's been added to it — reports, action items, old business,
// reminders, announcements) already exists by the time this runs. Not
// last meeting's minutes — this week's draft, so everyone can review
// what's actually on the agenda before they show up.
//
// This is meant to be driven by a daily cron job hitting
// app/api/cron/meeting-reminders (see vercel.json — "30 2 * * *", i.e.
// ~7:30pm Pacific during PDT/summer, chosen Aug 2026), not called from
// anywhere in the UI — Vercel's free (Hobby) tier only allows once-a-day
// cron schedules, so "24 hours before" here really means "the evening
// before," checked once daily. Vercel cron times are fixed UTC
// year-round (no DST awareness of their own), so this same schedule
// drifts to ~6:30pm Pacific once Pacific switches to standard time
// (PST) in November — a paid Vercel plan (more frequent cron, so the
// job itself can check the local hour) or a different scheduler
// entirely would be needed to hold it exactly at 7:30pm across the DST
// change; flagged in MODULES.md. This UTC drift is purely cosmetic
// (what hour it sends) — chapterTodayIso() below computes the actual
// *date* boundary correctly regardless, so DST never shifts which
// meeting counts as "tomorrow."
import { prisma } from "@/lib/prisma";
import { nextOccurrence, formatTime12h } from "@/lib/meetings";
import { formatMeetingDate } from "@/lib/meetingMinutes";
import { buildMeetingMinutesDocx, meetingMinutesFilename } from "@/lib/meetingMinutesExport";
import { buildBudgetWorkbook, budgetExportFilename } from "@/lib/budgetExport";
import { calculateBudgetTotals, isPendingApproval } from "@/lib/budgets";
import { buildLetterDocx, letterFilename } from "@/lib/letterExport";
import { letterTitle } from "@/lib/letters";
import { sendEmail } from "@/lib/email";
import { CHAPTER_FULL_NAME } from "@/lib/chapterConfig";
import type {
  Budget,
  BudgetLineItem,
  BudgetVersion,
  Letter,
  Meeting,
  MeetingNote,
  OfficerReport,
} from "@/app/generated/prisma/client";

type PendingBudget = { budget: Budget; version: BudgetVersion & { lineItems: BudgetLineItem[] } };
type MeetingWithExtras = Meeting & { officerReports: OfficerReport[]; notes: MeetingNote[] };

// Aug 2026 fix — this used to be the server's raw UTC calendar date
// (`new Date().toISOString().slice(0,10)`). Vercel serverless functions
// run in UTC by default regardless of where the chapter actually is
// (Pacific), so a cron firing in the evening Pacific time could already
// be on the *next* UTC calendar day — silently making "tomorrow" mean
// two days out from the chapter's actual local day, not one. Every
// Meeting.date/MeetingSchedule occurrence in this app is implicitly a
// Pacific calendar date (that's the chapter's own timezone), so "today"
// has to be computed the same way for the comparison to mean anything.
// Intl's timeZone conversion handles the PDT/PST switch automatically —
// no manual UTC-offset math, and no drift across the DST changeover.
function chapterTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export interface MeetingEmailContent {
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; content: Uint8Array }[];
}

// Everything that goes out for one specific meeting: this week's draft
// minutes, any Tentative budget still awaiting a chapter vote that
// landed on this meeting (see lib/meetingMinutesAutoAdd.ts), and any
// Letter of Excuse/Active Member Request that did the same (Aug 2026 —
// "any letters that may need to be read"). Built purely from the
// Meeting record itself (date/time), not a MeetingSchedule, so this
// works for a one-off meeting too, not just a recurring series.
export async function buildMeetingEmailContent(
  meeting: MeetingWithExtras,
  opts: { label?: string } = {}
): Promise<MeetingEmailContent> {
  const label = opts.label || "Chapter Meeting";
  const when = formatMeetingDate(meeting.date) + (meeting.time ? ` at ${meeting.time}` : "");
  const subject = `${label} — ${formatMeetingDate(meeting.date)}`;

  // Aug 2026 — "I just want it to say please review before the meeting
  // {enter meeting date here}, see you all tomorrow!"
  const minutesLine = `Please review before the meeting on ${formatMeetingDate(meeting.date)}, see you all tomorrow!`;

  const pendingBudgets: PendingBudget[] = (
    await prisma.budget.findMany({
      where: { addedToMeetingId: meeting.id },
      include: { versions: { include: { lineItems: true } } },
    })
  ).flatMap((budget) =>
    budget.versions
      .filter((v) => v.stage === "TENTATIVE" && isPendingApproval(v))
      .map((version) => ({ budget, version }))
  );

  // Letters (Letter of Excuse / Active Member Request) that auto-landed
  // on this same meeting via the "Add to Next Meeting Minutes" button —
  // see app/api/letters/[id]/add-to-minutes.
  const letters: Letter[] = await prisma.letter.findMany({
    where: { addedToMeetingId: meeting.id },
    orderBy: { date: "asc" },
  });

  // Anything an officer dropped onto this meeting directly (Aug 2026 —
  // "add a something where the meeting minutes are where I can drop in
  // files or anything else that will also be sent out with the meeting
  // minutes") — a flyer, a handout, a photo, whatever doesn't fit the
  // minutes docx itself. See app/(app)/meetings-reports/minutes/[id]/
  // MeetingAttachmentsSection.tsx.
  const droppedFiles = await prisma.meetingAttachment.findMany({
    where: { meetingId: meeting.id },
    orderBy: { createdAt: "asc" },
  });

  const budgetLines = pendingBudgets.map(
    (b) =>
      `${b.budget.eventName} (Chair: ${b.budget.chair}) — ${money(
        calculateBudgetTotals(b.version.lineItems, b.version.salesTaxRate).total
      )} — up for a vote at this meeting`
  );
  const letterLines = letters.map(
    (l) => `${letterTitle(l)} — ${l.createdByName}${l.recipientName ? `, re: ${l.recipientName}` : ""}`
  );
  const fileLines = droppedFiles.map((f) => `${f.label} (${f.fileName}) — added by ${f.uploadedByName}`);

  const text = [
    `${label}: ${when}.`,
    "",
    minutesLine,
    ...(budgetLines.length > 0
      ? ["", "Tentative budgets up for approval at this meeting:", ...budgetLines.map((l) => `- ${l}`)]
      : []),
    ...(letterLines.length > 0
      ? ["", "Letters to review at this meeting:", ...letterLines.map((l) => `- ${l}`)]
      : []),
    ...(fileLines.length > 0 ? ["", "Also attached:", ...fileLines.map((l) => `- ${l}`)] : []),
    "",
    `— ${CHAPTER_FULL_NAME}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p><strong>${label}</strong>: ${when}.</p>
    <p>${minutesLine}</p>
    ${
      budgetLines.length > 0
        ? `<p>Tentative budgets up for approval at this meeting:</p><ul>${budgetLines
            .map((l) => `<li>${l}</li>`)
            .join("")}</ul>`
        : ""
    }
    ${
      letterLines.length > 0
        ? `<p>Letters to review at this meeting:</p><ul>${letterLines.map((l) => `<li>${l}</li>`).join("")}</ul>`
        : ""
    }
    ${
      fileLines.length > 0
        ? `<p>Also attached:</p><ul>${fileLines.map((l) => `<li>${l}</li>`).join("")}</ul>`
        : ""
    }
    <p>— ${CHAPTER_FULL_NAME}</p>
  `;

  const attachments: { filename: string; content: Uint8Array }[] = [];
  const members = await prisma.member.findMany({ select: { name: true, role: true, status: true, email: true } });
  attachments.push({
    filename: meetingMinutesFilename(meeting),
    content: await buildMeetingMinutesDocx(meeting, meeting.officerReports, members, meeting.notes),
  });
  for (const { budget, version } of pendingBudgets) {
    attachments.push({ filename: budgetExportFilename(budget, version), content: await buildBudgetWorkbook(budget, version) });
  }
  for (const letter of letters) {
    attachments.push({ filename: letterFilename(letter), content: await buildLetterDocx(letter) });
  }
  for (const file of droppedFiles) {
    const base64 = file.fileData.split(",").pop() ?? "";
    attachments.push({ filename: file.fileName, content: new Uint8Array(Buffer.from(base64, "base64")) });
  }

  return { subject, html, text, attachments };
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
  const tomorrow = addDaysIso(chapterTodayIso(), 1);

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

    // Tomorrow's own Meeting record — not the last one. Meeting rows
    // auto-generate ahead of time for a whole term (see
    // lib/meetingGeneration.ts), and Officer Reports/action items get
    // submitted against the upcoming meeting all week, so this should
    // already exist with whatever's been filled in so far.
    const thisMeeting = await prisma.meeting.findFirst({
      where: { scheduleId: schedule.id, date: tomorrow },
      include: { officerReports: true, notes: true },
    });

    const label = schedule.label || "Chapter Meeting";
    let subject: string;
    let html: string;
    let text: string;
    let attachments: { filename: string; content: Uint8Array }[] = [];

    if (thisMeeting) {
      ({ subject, html, text, attachments } = await buildMeetingEmailContent(thisMeeting, { label }));
      subject = `Reminder: ${subject}`;
    } else {
      const when = formatMeetingDate(tomorrow) + (schedule.time ? ` at ${formatTime12h(schedule.time)}` : "");
      subject = `Reminder: ${label} tomorrow (${formatMeetingDate(tomorrow)})`;
      text = `${label} is tomorrow: ${when}.\n\nThere's no meeting record on file yet for this one — check the Minutes list closer to the date.\n\n— ${CHAPTER_FULL_NAME}`;
      html = `<p><strong>${label}</strong> is tomorrow: ${when}.</p><p>There's no meeting record on file yet for this one — check the Minutes list closer to the date.</p><p>— ${CHAPTER_FULL_NAME}</p>`;
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
