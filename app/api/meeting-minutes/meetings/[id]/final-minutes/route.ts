import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { isOfficer, ownsModule } from "@/lib/permissions";
import { parseFinalMinutesInput } from "@/lib/meetingFinalMinutes";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// The one finished/final minutes document for this meeting (Sept 2026
// — see lib/meetingFinalMinutes.ts). Downloading is open to any
// logged-in member — this is deliberately NOT gated to officers, unlike
// the Attachments download route (app/api/meeting-minutes/attachments/
// [id]/route.ts): the whole point is that the finished minutes are
// visible to everyone from the Meeting Minutes list page
// (app/(app)/meetings-reports/minutes/page.tsx), which is itself open
// to every logged-in member. Uploading/replacing/removing stays
// officer-only, same gate as the rest of this meeting's editing page.
export async function GET(_request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const final = await prisma.meetingFinalMinutes.findUnique({ where: { meetingId: id } });
  if (!final) {
    return NextResponse.json({ error: "No finished minutes uploaded yet." }, { status: 404 });
  }

  const base64 = final.fileData.split(",").pop() ?? "";
  const bytes = Buffer.from(base64, "base64");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": final.mimeType,
      "Content-Disposition": `attachment; filename="${final.fileName.replace(/"/g, "")}"`,
    },
  });
}

// Any officer can upload/replace — not just whoever uploaded it last —
// same as Attachments' own POST gate.
export async function POST(request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  if (!isOfficer(member)) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseFinalMinutesInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const final = await prisma.meetingFinalMinutes.upsert({
    where: { meetingId: id },
    create: { meetingId: id, ...parsed.data, uploadedByMemberId: member.id, uploadedByName: member.name },
    update: { ...parsed.data, uploadedByMemberId: member.id, uploadedByName: member.name },
    select: {
      id: true,
      meetingId: true,
      fileName: true,
      mimeType: true,
      uploadedByName: true,
      uploadedByMemberId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(final, { status: 201 });
}

// Whoever uploaded it, or the Secretary/President (module owner) — same
// shape as the Attachments delete gate.
export async function DELETE(_request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  if (!isOfficer(member)) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const { id } = await params;
  const final = await prisma.meetingFinalMinutes.findUnique({ where: { meetingId: id } });
  if (!final) {
    return NextResponse.json({ error: "No finished minutes uploaded yet." }, { status: 404 });
  }
  if (final.uploadedByMemberId !== member.id && !ownsModule(member, "meetings-reports")) {
    return NextResponse.json(
      { error: "Only whoever uploaded this, or the Secretary/President, can remove it." },
      { status: 403 }
    );
  }

  await prisma.meetingFinalMinutes.delete({ where: { meetingId: id } });
  return NextResponse.json({ ok: true });
}
