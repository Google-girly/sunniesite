import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";

// Thumbs up/down on one Chapter Assistant answer. Only the member who
// asked can rate it (or the President) — same "who's allowed to touch
// this row" shape as canManageRecord() in lib/permissions.ts, just not
// worth pulling that in for a single field on a module with no ModuleKey.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const rating = body?.rating;
  if (rating !== "up" && rating !== "down") {
    return NextResponse.json({ error: 'rating must be "up" or "down".' }, { status: 400 });
  }

  const interaction = await prisma.chapterAssistantInteraction.findUnique({ where: { id } });
  if (!interaction) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const isPresident = (member.role ?? "").split(",").map((r) => r.trim()).includes("President");
  if (interaction.memberId !== member.id && !isPresident) {
    return NextResponse.json({ error: "You can only rate your own questions." }, { status: 403 });
  }

  await prisma.chapterAssistantInteraction.update({ where: { id }, data: { feedback: rating } });
  return NextResponse.json({ ok: true });
}
