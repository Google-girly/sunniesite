import { NextResponse } from "next/server";
import { OFFICER_POSITIONS } from "@/lib/positions";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";
import { parseRoles } from "@/lib/roster";

// Upsert on (meetingId, position) — submitting again for the same
// meeting/position replaces the prior draft rather than accumulating
// duplicates (see prisma/schema.prisma OfficerReport for why).
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
  const position = typeof body.position === "string" ? body.position : "";
  if (!(OFFICER_POSITIONS as readonly string[]).includes(position)) {
    return NextResponse.json({ error: "Invalid officer position." }, { status: 400 });
  }
  // Every officer submits her own report — you can only submit as a
  // position you actually hold, unless you're the Secretary/President.
  if (!ownsModule(viewer, "meetings-reports") && !parseRoles(viewer.role).includes(position)) {
    return NextResponse.json(
      { error: "You can only submit a report for a position you hold." },
      { status: 403 }
    );
  }
  const report = typeof body.report === "string" ? body.report.trim() : "";
  if (!report) {
    return NextResponse.json({ error: "Report text is required." }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const officerReport = await prisma.officerReport.upsert({
    where: { meetingId_position: { meetingId, position } },
    create: { meetingId, position, report },
    update: { report },
  });

  return NextResponse.json(officerReport, { status: 201 });
}
