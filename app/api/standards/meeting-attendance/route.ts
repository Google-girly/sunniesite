import { NextResponse } from "next/server";
import { MEETINGS_PER_TERM } from "@/lib/standardsForms";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

// Upsert on (term, meetingNumber) — the real form has exactly 10 fixed,
// pre-numbered meeting rows per term, so "log meeting #3" always means
// replacing whatever's on file for #3 that term, not creating a
// duplicate row.
export async function POST(request: Request) {
  const access = await requireApiAccess("sisterhood");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const term = typeof body.term === "string" ? body.term.trim() : "";
  if (!term) {
    return NextResponse.json({ error: "Term is required." }, { status: 400 });
  }
  const meetingNumber = typeof body.meetingNumber === "number" ? body.meetingNumber : NaN;
  if (!Number.isInteger(meetingNumber) || meetingNumber < 1 || meetingNumber > MEETINGS_PER_TERM) {
    return NextResponse.json(
      { error: `Meeting number must be between 1 and ${MEETINGS_PER_TERM}.` },
      { status: 400 }
    );
  }

  const data = {
    date: str(body.date),
    activesAttended: int(body.activesAttended),
    quorumMet: typeof body.quorumMet === "boolean" ? body.quorumMet : null,
    officersAttended: int(body.officersAttended),
    otherAttendees: str(body.otherAttendees),
  };

  const record = await prisma.meetingAttendanceRecord.upsert({
    where: { term_meetingNumber: { term, meetingNumber } },
    create: { term, meetingNumber, ...data },
    update: data,
  });

  return NextResponse.json(record, { status: 201 });
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function int(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}
