import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

// Every Meeting under one series — read-only, open (same reasoning as
// GET /api/meetings). Used by the series detail page to re-fetch its
// own list after an edit auto-generates new ones (see
// lib/meetingGeneration.ts), without needing a full page reload.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get("scheduleId");
  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId is required." }, { status: 400 });
  }
  const meetings = await prisma.meeting.findMany({
    where: { scheduleId },
    // Most recent/soonest first, farthest-out last (Aug 2026) — matches
    // the series detail page's own initial ordering.
    orderBy: { date: "asc" },
  });
  return NextResponse.json(meetings);
}

// Logging a new meeting (date/time it happened) is the same "anything
// with the meetings" bucket as editing the recurring schedule — Vice
// President of Communications, Historian, or President. Submitting an
// Officer Report against an existing meeting is a separate route
// (app/api/meeting-minutes/reports) and stays open to everyone.
export async function POST(request: Request) {
  const access = await requireModuleOwnerApi("meetings-reports");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }
  const time = typeof body.time === "string" && body.time.trim() ? body.time.trim() : null;
  const scheduleId = typeof body.scheduleId === "string" && body.scheduleId ? body.scheduleId : null;

  const meeting = await prisma.meeting.create({
    data: { date, time, scheduleId },
    include: { officerReports: true },
  });

  return NextResponse.json(meeting, { status: 201 });
}
