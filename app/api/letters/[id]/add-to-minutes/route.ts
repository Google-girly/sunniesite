import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";
import { addActionItemToNextMeeting } from "@/lib/meetingMinutesAutoAdd";
import { letterTitle } from "@/lib/letters";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// "Letter of Excuse/requesting to go active" gets an Add to Next
// Meeting Minutes button (Aug 2026) — same 24h05m cutoff as budgets'
// automatic version, see lib/meetingMinutesAutoAdd.ts.
const ELIGIBLE_LETTER_TYPES = ["Letter of Excuse", "Active Member Request"];

export async function POST(_request: Request, { params }: RouteParams) {
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
    return NextResponse.json({ error: "Only who created this (or the President) can do this." }, { status: 403 });
  }
  if (!ELIGIBLE_LETTER_TYPES.includes(letter.type)) {
    return NextResponse.json(
      { error: "Only Letter of Excuse or Active Member Request can be added to the minutes this way." },
      { status: 400 }
    );
  }
  if (letter.addedToMeetingId) {
    return NextResponse.json({ error: "Already added to a meeting's minutes." }, { status: 400 });
  }
  // Aug 2026 — a draft can't be sent out half-empty just because someone
  // clicked this button; finish the body first.
  if (!letter.purpose.trim()) {
    return NextResponse.json({ error: "Fill in the letter body before adding it to the minutes." }, { status: 400 });
  }

  const added = await addActionItemToNextMeeting(`${letterTitle(letter)} — ${letter.purpose}`, {
    id: member.id,
    name: member.name,
  });
  if (!added) {
    return NextResponse.json(
      { error: "No upcoming meeting far enough out yet — check back once the next one's on the calendar." },
      { status: 400 }
    );
  }

  // Aug 2026 — "only publish them to everyone if they add them to the
  // meeting minutes": this is the other of the two ways a draft
  // publishes (the normal finalize/save path is the other) — see
  // GET /api/letters for what isDraft actually gates.
  await prisma.letter.update({ where: { id }, data: { addedToMeetingId: added.meetingId, isDraft: false } });
  return NextResponse.json(added);
}
