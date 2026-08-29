import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { isOfficer } from "@/lib/permissions";
import { parseMeetingAttachmentInput } from "@/lib/meetingAttachments";

// Files dropped onto a specific meeting (Aug 2026) — same officer-only
// gate as the Meeting Minutes editing page itself (see
// app/(app)/meetings-reports/minutes/[id]/page.tsx); listing is scoped
// to one meeting via ?meetingId=, never the whole table, since this is
// only ever shown on that meeting's own page.
export async function GET(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  if (!isOfficer(member)) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const meetingId = searchParams.get("meetingId");
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId is required." }, { status: 400 });
  }

  const attachments = await prisma.meetingAttachment.findMany({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
    select: { id: true, meetingId: true, label: true, fileName: true, mimeType: true, uploadedByName: true, uploadedByMemberId: true, createdAt: true },
  });
  return NextResponse.json(attachments);
}

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  if (!isOfficer(member)) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseMeetingAttachmentInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: parsed.data.meetingId } });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const attachment = await prisma.meetingAttachment.create({
    data: { ...parsed.data, uploadedByMemberId: member.id, uploadedByName: member.name },
    select: { id: true, meetingId: true, label: true, fileName: true, mimeType: true, uploadedByName: true, uploadedByMemberId: true, createdAt: true },
  });
  return NextResponse.json(attachment, { status: 201 });
}
