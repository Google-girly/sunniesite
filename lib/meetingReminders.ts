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
import { buildBudgetWorkbook, budgetExportFilename } from "@/lib/budgetExport";
import { calculateBudgetTotals, isPendingApproval } from "@/lib/budgets";
import { sendEmail } from "@/lib/email";
import { CHAPTER_FULL_NAME } from "@/lib/chapterConfig";
import type {
  Budget,
  BudgetLineItem,
  BudgetVersion,
  Meeting,
  MeetingSchedule,
  OfficerReport,
} from "@/app/generated/prisma/client";

type PendingBudget = { budget: Budget; version: BudgetVersion & { lineItems: BudgetLineItem[] } };

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
  thisMeeting: (Meeting & { officerReports: OfficerReport[] }) | null,
  pendingBudgets: PendingBudget[]
): { subject: string; html: string; text: string } {
  const label = schedule.label || "Chapter Meeting";
  const when = formatMeetingDate(meetingDate) + (schedule.time ? ` at ${formatTime12h(schedule.time)}` : "");
  const subject = `Reminder: ${label} tomorrow (${formatMeetingDate(meetingDate)})`;

  const minutesLine = thisMeeting
    ? "Attached (and linked below) are this week's draft minutes — whatever's been filled in so far — please review before you come."
    : "There's no meeting record on file yet for this one — check the Minutes list closer to the date.";
  // Links to the Minutes list (open to every logged-in member) rather
  // than a specific meeting's own page — that page is officer-only
  // (Aug 2026), and this reminder goes out to every Active member, most
  // of whom aren't officers.
  const minutesLink = thisMeeting ? `${baseUrl()}/meetings-reports/minutes` : null;

  // Aug 2026 — "the tentative budgets should be awaiting approval in the
  // queue and it should also be sent out along with the meeting minutes
  // for the next meeting." Each still-pending Tentative budget that
  // landed on this meeting (see lib/meetingMinutesAutoAdd.ts, called from
  // POST /api/budgets) gets its own line here plus its own workbook
  // attached below, same treatment as the minutes docx.
  const budgetLines = pendingBudgets.map(
    (b) =>
      `${b.budget.eventName} (Chair: ${b.budget.chair}) — ${money(
        calculateBudgetTotals(b.version.lineItems, b.version.salesTaxRate).total
      )} — up for a vote at this meeting`
  );

  const text = [
    `${label} is tomorrow: ${when}.`,
    "",
    minutesLine,
    minutesLink ? minutesLink : "",
    ...(budgetLines.length > 0
      ? ["", "Tentative budgets up for approval at this meeting:", ...budgetLines.map((l) => `- ${l}`)]
      : []),
    "",
    `— ${CHAPTER_FULL_NAME}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p><strong>${label}</strong> is tomorrow: ${when}.</p>
    <p>${minutesLine}</p>
    ${minutesLink ? `<p><a href="${minutesLink}">${minutesLink}</a></p>` : ""}
    ${
      budgetLines.length > 0
        ? `<p>Tentative budgets up for approval at this meeting:</p><ul>${budgetLines
            .map((l) => `<li>${l}</li>`)
            .join("")}</ul>`
        : ""
    }
    <p>— ${CHAPTER_FULL_NAME}</p>
  `;

  return { subject, html, text };
}

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
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

    // Tomorrow's own Meeting record — not the last one. Meeting rows
    // auto-generate ahead of time for a whole term (see
    // lib/meetingGeneration.ts), and Officer Reports/action items get
    // submitted against the upcoming meeting all week, so this should
    // already exist with whatever's been filled in so far.
    const thisMeeting = await prisma.meeting.findFirst({
      where: { scheduleId: schedule.id, date: tomorrow },
      include: { officerReports: true, notes: true },
    });

    // Tentative budgets that auto-landed on this same meeting (see
    // lib/meetingMinutesAutoAdd.ts) and still haven't gotten a chapter
    // vote — these go out to Actives too, not just the minutes.
    const pendingBudgets: PendingBudget[] = thisMeeting
      ? (
          await prisma.budget.findMany({
            where: { addedToMeetingId: thisMeeting.id },
            include: { versions: { include: { lineItems: true } } },
          })
        ).flatMap((budget) =>
          budget.versions
            .filter((v) => v.stage === "TENTATIVE" && isPendingApproval(v))
            .map((version) => ({ budget, version }))
        )
      : [];

    const { subject, html, text } = buildReminderEmail(schedule, tomorrow, thisMeeting, pendingBudgets);

    const attachments: { filename: string; content: Uint8Array }[] = [];
    if (thisMeeting) {
      const members = await prisma.member.findMany({ select: { name: true, role: true, status: true, email: true } });
      const bytes = await buildMeetingMinutesDocx(thisMeeting, thisMeeting.officerReports, members, thisMeeting.notes);
      attachments.push({ filename: meetingMinutesFilename(thisMeeting), content: bytes });
    }
    for (const { budget, version } of pendingBudgets) {
      const bytes = await buildBudgetWorkbook(budget, version);
      attachments.push({ filename: budgetExportFilename(budget, version), content: bytes });
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
