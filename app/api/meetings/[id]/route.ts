import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireModuleOwnerApi("meetings-reports");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: {
    dayOfWeek?: number;
    intervalWeeks?: number;
    anchorDate?: string;
    label?: string | null;
    time?: string | null;
    active?: boolean;
  } = {};

  if (typeof body.dayOfWeek === "number") {
    if (!Number.isInteger(body.dayOfWeek) || body.dayOfWeek < 0 || body.dayOfWeek > 6) {
      return NextResponse.json({ error: "Day of week must be 0-6." }, { status: 400 });
    }
    data.dayOfWeek = body.dayOfWeek;
  }
  if (typeof body.intervalWeeks === "number") {
    if (!Number.isInteger(body.intervalWeeks) || body.intervalWeeks < 1) {
      return NextResponse.json({ error: "Interval must be at least 1 week." }, { status: 400 });
    }
    data.intervalWeeks = body.intervalWeeks;
  }
  if (typeof body.anchorDate === "string") {
    const anchorDate = body.anchorDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
      return NextResponse.json(
        { error: "A real date this series meets on is required." },
        { status: 400 }
      );
    }
    data.anchorDate = anchorDate;
  }
  if (typeof body.label === "string") data.label = body.label.trim() || null;
  if (typeof body.time === "string") data.time = body.time.trim() || null;
  if (typeof body.active === "boolean") data.active = body.active;

  try {
    const schedule = await prisma.meetingSchedule.update({ where: { id }, data });
    return NextResponse.json(schedule);
  } catch {
    return NextResponse.json({ error: "Meeting schedule not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireModuleOwnerApi("meetings-reports");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.meetingSchedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Meeting schedule not found." }, { status: 404 });
  }
}
