import { NextResponse } from "next/server";
import { parseLetterInput } from "@/lib/letters";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Aug 2026 — while a letter is a draft, it's "isolated to the person":
// only its creator can touch it at all, not even the President (she
// can't see it in the list to begin with — see GET /api/letters — but
// this also blocks a direct request against the id). Once it's no
// longer a draft, the normal creator-or-President rule applies, same as
// every other letter route.
function canManage(letter: { createdByMemberId: string | null; isDraft: boolean }, member: { id: string; role: string | null }): boolean {
  if (letter.createdByMemberId === member.id) return true;
  if (letter.isDraft) return false;
  return ownsModule(member, "letters");
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const { id } = await params;
  const letter = await prisma.letter.findUnique({ where: { id } });
  if (!letter) {
    return NextResponse.json({ error: "Letter not found." }, { status: 404 });
  }
  if (!canManage(letter, member)) {
    return NextResponse.json({ error: "Only who created this (or the President) can edit it." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseLetterInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await prisma.letter.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const { id } = await params;
  const letter = await prisma.letter.findUnique({ where: { id } });
  if (!letter) {
    return NextResponse.json({ error: "Letter not found." }, { status: 404 });
  }
  if (!canManage(letter, member)) {
    return NextResponse.json({ error: "Only who created this (or the President) can remove it." }, { status: 403 });
  }
  await prisma.letter.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
