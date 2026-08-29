import { NextResponse } from "next/server";
import { buildMeetingMinutesDocx, meetingMinutesFilename } from "@/lib/meetingMinutesExport";
import { buildMeetingMinutesHtml } from "@/lib/meetingMinutesHtml";
import { renderHtmlToPdf } from "@/lib/htmlToPdf";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";

// Needs real Node APIs (headless Chromium via puppeteer-core) — not
// available on the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60; // headless Chromium cold-starts can take a few seconds on top of the render itself

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PDF twin of app/api/meeting-minutes/export/[id] — same access (any
// logged-in member) and same underlying document: this literally
// renders the real generated .docx (via mammoth.js → HTML → headless
// Chromium's print engine), not a separate re-implementation. See
// lib/meetingMinutesHtml.ts and lib/htmlToPdf.ts.
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

  const docxBytes = await buildMeetingMinutesDocx(meeting, meeting.officerReports, members, meeting.notes);
  const html = await buildMeetingMinutesHtml(docxBytes);
  const pdfBytes = await renderHtmlToPdf(html);

  const file = new Uint8Array(pdfBytes.length);
  file.set(pdfBytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${meetingMinutesFilename(meeting).replace(/\.docx$/, ".pdf")}"`,
    },
  });
}
