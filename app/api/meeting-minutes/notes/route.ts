import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { isMeetingNoteCategory } from "@/lib/meetingNotes";

// Any logged-in member can add an Action Item / Old Business / Reminder
// / Announcement — unlike OfficerReport, this isn't gated to a
// position. See prisma/schema.prisma MeetingNote for why.
export async function POST(request: Request) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const meetingId = typeof body.meetingId === "string" ? body.meetingId.trim() : "";
  if (!meetingId) {
    return NextResponse.json({ error: "Meeting is required." }, { status: 400 });
  }
  const category = typeof body.category === "string" ? body.category : "";
  if (!isMeetingNoteCategory(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const note = await prisma.meetingNote.create({
    data: { meetingId, category, text, authorMemberId: viewer.id, authorName: viewer.name },
    include: { author: true },
  });

  return NextResponse.json(note, { status: 201 });
}
