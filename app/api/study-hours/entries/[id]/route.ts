import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { canManageRecord } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.studyHourEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  if (!canManageRecord(viewer, "study-hours", existing.memberId)) {
    return NextResponse.json({ error: "You can only edit your own study hours." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: {
    date?: string;
    location?: string;
    hours?: number;
    timeIn?: string;
    timeOut?: string;
  } = {};

  if (typeof body.date === "string") {
    const date = body.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    data.date = date;
  }
  if (typeof body.location === "string") {
    const location = body.location.trim();
    if (!location) {
      return NextResponse.json({ error: "Study location is required." }, { status: 400 });
    }
    data.location = location;
  }
  if (typeof body.hours === "number") {
    if (!Number.isFinite(body.hours) || body.hours <= 0) {
      return NextResponse.json(
        { error: "Hours must be a number greater than zero." },
        { status: 400 }
      );
    }
    data.hours = body.hours;
  }
  if (typeof body.timeIn === "string") {
    const timeIn = body.timeIn.trim();
    if (!/^\d{1,2}:\d{2}$/.test(timeIn)) {
      return NextResponse.json({ error: "Time In is required." }, { status: 400 });
    }
    data.timeIn = timeIn;
  }
  if (typeof body.timeOut === "string") {
    const timeOut = body.timeOut.trim();
    if (!/^\d{1,2}:\d{2}$/.test(timeOut)) {
      return NextResponse.json({ error: "Time Out is required." }, { status: 400 });
    }
    data.timeOut = timeOut;
  }

  try {
    const entry = await prisma.studyHourEntry.update({ where: { id }, data });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.studyHourEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  if (!canManageRecord(viewer, "study-hours", existing.memberId)) {
    return NextResponse.json({ error: "You can only remove your own study hours." }, { status: 403 });
  }

  await prisma.studyHourEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
