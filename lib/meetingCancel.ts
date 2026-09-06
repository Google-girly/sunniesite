// "Add something where I can cancel a meeting and anything that is in
// this week's meeting minutes goes to the next" (Sept 2026). Cancelling
// never deletes the Meeting row (so the date stays visible, marked
// Cancelled, instead of just disappearing) — it reassigns everything
// that was building up on it onto whichever meeting comes next, then
// flips `cancelled`. Reused by both the manual "Cancel" button and
// anything else that might want to do the same thing later.
//
// What moves: Officer Reports, Meeting Notes (Action Items/Old
// Business/Reminders/Announcements), dropped Attachments, and any
// Budget/Letter that auto-landed on this meeting via "Add to Next
// Meeting Minutes" (lib/meetingMinutesAutoAdd.ts) — everything that's
// actually *content for the minutes*. What stays behind: the Quorum/
// attendance snapshot and any uploaded MeetingFinalMinutes, both of
// which describe what happened at *this* specific meeting, and a
// cancelled meeting never happened.
import { prisma } from "@/lib/prisma";
import type { Meeting } from "@/app/generated/prisma/client";

export interface CancelMeetingResult {
  cancelledMeetingId: string;
  targetMeetingId: string;
  targetMeetingDate: string;
  reportsMoved: number;
  reportsMerged: number;
  notesMoved: number;
  attachmentsMoved: number;
  budgetsMoved: number;
  lettersMoved: number;
}

export type CancelMeetingOutcome = { result: CancelMeetingResult } | { error: string };

// The next meeting on the calendar after this one, skipping over any
// that are themselves already cancelled (moving content onto a meeting
// that isn't going to happen either would just repeat the problem).
export async function findNextMeetingForCancel(meeting: Pick<Meeting, "id" | "date">): Promise<Meeting | null> {
  return prisma.meeting.findFirst({
    where: { date: { gt: meeting.date }, cancelled: false, id: { not: meeting.id } },
    orderBy: { date: "asc" },
  });
}

export async function cancelMeetingAndMoveContent(meetingId: string): Promise<CancelMeetingOutcome> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { officerReports: true, finalMinutes: { select: { id: true } } },
  });
  if (!meeting) return { error: "Meeting not found." };
  if (meeting.cancelled) return { error: "This meeting is already cancelled." };
  if (meeting.finalMinutes) {
    return { error: "This meeting already has finished minutes on file — it already happened, so it can't be cancelled." };
  }

  const target = await findNextMeetingForCancel(meeting);
  if (!target) {
    return {
      error: "No upcoming meeting to move this one's minutes to yet — add the next meeting first, then cancel this one.",
    };
  }

  const targetReports = await prisma.officerReport.findMany({
    where: { meetingId: target.id },
    select: { id: true, position: true, report: true },
  });
  const targetReportByPosition = new Map(targetReports.map((r) => [r.position, r]));

  let reportsMoved = 0;
  let reportsMerged = 0;
  let notesMoved = 0;
  let attachmentsMoved = 0;
  let budgetsMoved = 0;
  let lettersMoved = 0;

  await prisma.$transaction(async (tx) => {
    for (const report of meeting.officerReports) {
      const existing = targetReportByPosition.get(report.position);
      if (existing) {
        // The next meeting already has its own report for this position
        // (an officer wrote ahead) — merge rather than dropping either
        // side, since the unique (meetingId, position) constraint means
        // only one row can survive.
        await tx.officerReport.update({
          where: { id: existing.id },
          data: {
            report: `${report.report}\n\n— Carried over from the cancelled meeting on ${meeting.date}:\n${existing.report}`,
          },
        });
        await tx.officerReport.delete({ where: { id: report.id } });
        reportsMerged++;
      } else {
        await tx.officerReport.update({ where: { id: report.id }, data: { meetingId: target.id } });
        reportsMoved++;
      }
    }

    notesMoved = (
      await tx.meetingNote.updateMany({ where: { meetingId: meeting.id }, data: { meetingId: target.id } })
    ).count;
    attachmentsMoved = (
      await tx.meetingAttachment.updateMany({ where: { meetingId: meeting.id }, data: { meetingId: target.id } })
    ).count;
    budgetsMoved = (
      await tx.budget.updateMany({ where: { addedToMeetingId: meeting.id }, data: { addedToMeetingId: target.id } })
    ).count;
    lettersMoved = (
      await tx.letter.updateMany({ where: { addedToMeetingId: meeting.id }, data: { addedToMeetingId: target.id } })
    ).count;

    await tx.meeting.update({ where: { id: meeting.id }, data: { cancelled: true } });
  });

  return {
    result: {
      cancelledMeetingId: meeting.id,
      targetMeetingId: target.id,
      targetMeetingDate: target.date,
      reportsMoved,
      reportsMerged,
      notesMoved,
      attachmentsMoved,
      budgetsMoved,
      lettersMoved,
    },
  };
}
