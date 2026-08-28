// A personal "what do I still owe the chapter" list for the Dashboard
// (Aug 2026) — not a manually-kept list anyone edits, but items derived
// live from data that already exists elsewhere in the app: her own
// position(s)' officer reports, this month's Sister of the Month
// ballot, her own account balance, and this week's study hours. Each
// item links straight to where she'd actually go take care of it.
import type { Member } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseRoles } from "@/lib/roster";
import { formatMeetingDate } from "@/lib/meetingMinutes";
import { currentVotingPeriod } from "@/lib/sisterOfMonthVoting";
import { calculateBalance, formatCurrency } from "@/lib/fines";
import { WEEKLY_HOURS_REQUIRED, weekStart } from "@/lib/studyHours";

export interface ToDoItem {
  id: string;
  label: string;
  /** Omitted when there's nowhere she's actually allowed to click through to (e.g. Fines is Treasurer/President-only). */
  href?: string;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getMyToDoItems(member: Member): Promise<ToDoItem[]> {
  const items: ToDoItem[] = [];

  // 1. Officer report(s) — for each position she holds, is there a
  // report on file for the most recently logged meeting? (Submission is
  // still honor-system/not tied to who's logged in — see
  // MeetingMinutesClient — this just flags that her position's slot is
  // still empty.)
  const positions = parseRoles(member.role);
  if (positions.length > 0) {
    const latestMeeting = await prisma.meeting.findFirst({
      orderBy: { date: "desc" },
      include: { officerReports: true },
    });
    if (latestMeeting) {
      const reported = new Set(latestMeeting.officerReports.map((r) => r.position));
      for (const position of positions) {
        if (!reported.has(position)) {
          items.push({
            id: `officer-report-${position}`,
            label: `Submit the ${position} report for ${formatMeetingDate(latestMeeting.date)}`,
            href: `/meetings-reports/minutes/${latestMeeting.id}`,
          });
        }
      }
    }
  }

  // 2. Sister of the Month — Active members only, and only while this
  // month's ballot is genuinely still open (see
  // lib/sisterOfMonthVoting.ts + the vote route for the exact rules).
  if (member.status === "ACTIVE") {
    const period = currentVotingPeriod();
    if (period) {
      const [alreadyDecided, myVote] = await Promise.all([
        prisma.sisterOfTheMonth.findUnique({
          where: { year_month: { year: period.year, month: period.month } },
        }),
        prisma.sisterOfMonthVote.findUnique({
          where: { year_month_voterId: { year: period.year, month: period.month, voterId: member.id } },
        }),
      ]);
      if (!alreadyDecided && !myVote) {
        items.push({
          id: "sotm-vote",
          label: `Vote for ${period.month}'s Sister of the Month`,
        });
      }
    }
  }

  // 3. Account balance — no href: Fines & Member Accounts is
  // Treasurer/President-locked (see lib/permissions.ts), so there's
  // nowhere for a general member to click through to. Informational
  // only until/unless that changes.
  const entries = await prisma.accountEntry.findMany({ where: { memberId: member.id } });
  const balance = calculateBalance(entries);
  if (balance > 0) {
    items.push({
      id: "balance",
      label: `Pay your balance — ${formatCurrency(balance)} owed (see the Treasurer)`,
    });
  }

  // 4. Study hours this week — Active/Inactive only, per Chapter
  // Standards §B.4/§B.6 (Active Alumnae etc. aren't held to this).
  if (member.status === "ACTIVE" || member.status === "INACTIVE") {
    const thisWeek = weekStart(todayIso());
    const weekEntries = await prisma.studyHourEntry.findMany({
      where: { memberId: member.id, date: { gte: thisWeek } },
    });
    const loggedThisWeek = weekEntries.filter((e) => weekStart(e.date) === thisWeek);
    const hoursSoFar = loggedThisWeek.reduce((sum, e) => sum + e.hours, 0);
    if (hoursSoFar < WEEKLY_HOURS_REQUIRED) {
      items.push({
        id: "study-hours",
        label: `Log your study hours this week (${hoursSoFar}/${WEEKLY_HOURS_REQUIRED} so far)`,
        href: `/study-hours/${member.id}`,
      });
    }
  }

  return items;
}
