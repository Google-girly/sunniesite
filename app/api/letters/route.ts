import { NextResponse } from "next/server";
import { parseLetterInput } from "@/lib/letters";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";

// Any logged-in member creates her own letters (open-submit); she only
// ever sees her own list back here — the President (ownsModule's
// always-true case) sees every letter, per "make sure there is a place
// where they are stored for the president to see."
export async function GET() {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const letters = await prisma.letter.findMany({
    where: ownsModule(member, "letters") ? {} : { createdByMemberId: member.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(letters);
}

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseLetterInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const letter = await prisma.letter.create({
    data: { ...parsed.data, createdByMemberId: member.id, createdByName: member.name },
  });
  return NextResponse.json(letter, { status: 201 });
}
