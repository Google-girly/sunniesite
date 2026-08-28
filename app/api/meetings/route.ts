import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";
import { fillMissingMeetings } from "@/lib/meetingGeneration";

export async function GET() {
  // Read-only, open — Budgets reads this for its Date Due suggestion,
  // and there's nothing sensitive about the schedule itself.
  const schedules = await prisma.meetingSchedule.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(schedules);
}

// Setting up the recurring schedule is the Secretary's (Vice President
// of Communications) job — see lib/permissions.ts.
export async function POST(request: Request) {
  const access = await requireModuleOwnerApi("meetings-reports");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);

  const dayOfWeek = typeof body?.dayOfWeek === "number" ? body.dayOfWeek : NaN;
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ error: "Day of week is required." }, { status: 400 });
  }

  const intervalWeeks =
    typeof body?.intervalWeeks === "number" && Number.isInteger(body.intervalWeeks) && body.intervalWeeks >= 1
      ? body.intervalWeeks
      : 1;

  const anchorDate = typeof body?.anchorDate === "string" ? body.anchorDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
    return NextResponse.json(
      { error: "A real date this series meets on is required." },
      { status: 400 }
    );
  }

  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : null;
  const time = typeof body?.time === "string" && body.time.trim() ? body.time.trim() : null;

  let endDate: string | null = null;
  if (typeof body?.endDate === "string" && body.endDate.trim()) {
    const endDateInput: string = body.endDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateInput)) {
      return NextResponse.json({ error: "End date isn't a real date." }, { status: 400 });
    }
    if (endDateInput < anchorDate) {
      return NextResponse.json({ error: "End date can't be before the date this series meets on." }, { status: 400 });
    }
    endDate = endDateInput;
  }

  const schedule = await prisma.meetingSchedule.create({
    data: { dayOfWeek, intervalWeeks, anchorDate, endDate, label, time },
  });

  // Meeting minutes auto-generate for every occurrence through endDate,
  // if one was given — see lib/meetingGeneration.ts.
  const meetingsGenerated = await fillMissingMeetings(schedule);

  return NextResponse.json({ ...schedule, meetingsGenerated }, { status: 201 });
}
