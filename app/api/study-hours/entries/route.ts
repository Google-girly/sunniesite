import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { canManageRecord } from "@/lib/permissions";

export async function POST(request: Request) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) {
    return NextResponse.json({ error: "Member is required." }, { status: 400 });
  }
  // Self-service — you can log hours for yourself; only the Vice
  // President/President can log for someone else.
  if (!canManageRecord(viewer, "study-hours", memberId)) {
    return NextResponse.json({ error: "You can only log your own study hours." }, { status: 403 });
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }

  const location = typeof body.location === "string" ? body.location.trim() : "";
  if (!location) {
    return NextResponse.json({ error: "Study location is required." }, { status: 400 });
  }

  const hours = typeof body.hours === "number" ? body.hours : NaN;
  if (!Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json(
      { error: "Hours must be a number greater than zero." },
      { status: 400 }
    );
  }

  const timeIn = typeof body.timeIn === "string" ? body.timeIn.trim() : "";
  if (!/^\d{1,2}:\d{2}$/.test(timeIn)) {
    return NextResponse.json({ error: "Time In is required." }, { status: 400 });
  }
  const timeOut = typeof body.timeOut === "string" ? body.timeOut.trim() : "";
  if (!/^\d{1,2}:\d{2}$/.test(timeOut)) {
    return NextResponse.json({ error: "Time Out is required." }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const entry = await prisma.studyHourEntry.create({
    data: { memberId, date, location, hours, timeIn, timeOut },
  });

  return NextResponse.json(entry, { status: 201 });
}
