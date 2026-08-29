import { NextResponse } from "next/server";
import { buildMeetingMinutesDocx, meetingMinutesFilename } from "@/lib/meetingMinutesExport";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Downloading the compiled Minutes is open to every logged-in member
// (Aug 2026 — "anyone should be able to export the minutes"); only
// *editing* officer reports (app/(app)/meetings-reports/minutes/[id])
// stays officer-only.
export async function GET(_request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { officerReports: true, notes: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }
  const members = await prisma.member.findMany({ select: { name: true, role: true, status: true, email: true } });

  const bytes = await buildMeetingMinutesDocx(meeting, meeting.officerReports, members, meeting.notes);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${meetingMinutesFilename(meeting)}"`,
    },
  });
}
