import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { isOfficer, ownsModule } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Streams the actual file back out — the list route deliberately omits
// fileData to stay lightweight, so downloading is its own request. Same
// officer-only gate as the meeting page itself.
export async function GET(_request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  if (!isOfficer(member)) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const { id } = await params;
  const attachment = await prisma.meetingAttachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const base64 = attachment.fileData.split(",").pop() ?? "";
  const bytes = Buffer.from(base64, "base64");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
    },
  });
}

// Whoever uploaded it, or the Secretary/President (module owner) — same
// shape as MeetingNoteSection's own canRemove check on the client.
export async function DELETE(_request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  if (!isOfficer(member)) {
    return NextResponse.json({ error: "Officers only." }, { status: 403 });
  }

  const { id } = await params;
  const attachment = await prisma.meetingAttachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (attachment.uploadedByMemberId !== member.id && !ownsModule(member, "meetings-reports")) {
    return NextResponse.json(
      { error: "Only whoever uploaded this, or the Secretary/President, can remove it." },
      { status: 403 }
    );
  }

  await prisma.meetingAttachment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
