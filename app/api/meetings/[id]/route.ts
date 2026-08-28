import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";
import { fillMissingMeetings } from "@/lib/meetingGeneration";

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
    endDate?: string | null;
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
  if (typeof body.endDate === "string") {
    const endDate = body.endDate.trim();
    if (endDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return NextResponse.json({ error: "End date isn't a real date." }, { status: 400 });
      }
      data.endDate = endDate;
    } else {
      data.endDate = null; // empty string clears it — indefinite again, no more auto-generation
    }
  }
  if (typeof body.label === "string") data.label = body.label.trim() || null;
  if (typeof body.time === "string") data.time = body.time.trim() || null;
  if (typeof body.active === "boolean") data.active = body.active;

  const existing = await prisma.meetingSchedule.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Meeting schedule not found." }, { status: 404 });
  }

  // Validate against the *merged* result (this patch's fields layered
  // on whatever's already saved) before writing anything — an
  // anchorDate-only edit still needs checking against an endDate set
  // in some earlier request, and vice versa.
  const effectiveAnchorDate = data.anchorDate ?? existing.anchorDate;
  const effectiveEndDate = "endDate" in data ? data.endDate : existing.endDate;
  if (effectiveEndDate && effectiveEndDate < effectiveAnchorDate) {
    return NextResponse.json(
      { error: "End date can't be before the date this series meets on." },
      { status: 400 }
    );
  }

  try {
    const schedule = await prisma.meetingSchedule.update({ where: { id }, data });
    // Fills in whatever's still missing between anchorDate and
    // endDate, whether endDate was just set/changed or already there
    // and something else (day/interval/anchor) changed — see
    // lib/meetingGeneration.ts. No-ops (returns 0) if endDate is null.
    const meetingsGenerated = await fillMissingMeetings(schedule);
    return NextResponse.json({ ...schedule, meetingsGenerated });
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
