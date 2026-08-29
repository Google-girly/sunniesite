import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
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
  if (letter.createdByMemberId !== member.id && !ownsModule(member, "letters")) {
    return NextResponse.json({ error: "Only who created this (or the President) can remove it." }, { status: 403 });
  }
  await prisma.letter.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
