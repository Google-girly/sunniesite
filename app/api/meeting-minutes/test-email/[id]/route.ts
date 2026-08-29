import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { isOfficer } from "@/lib/permissions";
import { buildMeetingEmailContent } from "@/lib/meetingReminders";
import { sendEmail } from "@/lib/email";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// "I also want to test the emails are working can you add a dummy test
// emails on the meeting minutes page. This will allow me to send an
// email only to destorres@csumb.edu" (Aug 2026) — a one-off send of the
// exact same email the real reminder would send for this meeting
// (minutes + pending tentative budgets + letters due), but always to
// this single fixed address, regardless of who clicks the button or
// what's actually on the Active roster — and never touches
// MeetingReminderLog, so it can't interfere with (or get blocked by) the
// real once-daily reminder for this same meeting.
const TEST_RECIPIENT = "destorres@csumb.edu";

export async function POST(_request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  if (!isOfficer(member)) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { officerReports: true, notes: true, schedule: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const { subject, html, text, attachments } = await buildMeetingEmailContent(meeting, {
    label: meeting.schedule?.label || "Chapter Meeting",
    isTest: true,
  });

  try {
    await sendEmail({ to: [TEST_RECIPIENT], subject, html, text, attachments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: `Could not send the test email: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: TEST_RECIPIENT });
}
