import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Her own note, or whoever owns meetings-reports (Vice President of
// Communications, Historian, President) — same shape as
// OfficerReport's DELETE.
export async function DELETE(_request: Request, { params }: RouteParams) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.meetingNote.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  if (existing.authorMemberId !== viewer.id && !ownsModule(viewer, "meetings-reports")) {
    return NextResponse.json({ error: "You can only remove your own note." }, { status: 403 });
  }

  await prisma.meetingNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
