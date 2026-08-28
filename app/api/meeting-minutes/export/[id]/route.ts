import { NextResponse } from "next/server";
import { buildMeetingMinutesDocx, meetingMinutesFilename } from "@/lib/meetingMinutesExport";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Compiling the final, official Minutes document is the Secretary's
// (Vice President of Communications) job — see lib/permissions.ts.
export async function GET(_request: Request, { params }: RouteParams) {
  const access = await requireModuleOwnerApi("meetings-reports");
  if ("error" in access) return access.error;

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
