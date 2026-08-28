import { NextResponse } from "next/server";
import { isPlanPeriod, STRATEGIC_PRIORITY_AREAS } from "@/lib/standardsForms";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function GET() {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const goals = await prisma.strategicPlanGoal.findMany({
    orderBy: [{ academicYear: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(goals);
}

export async function POST(request: Request) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const academicYear = typeof body.academicYear === "string" ? body.academicYear.trim() : "";
  const priorityArea = typeof body.priorityArea === "string" ? body.priorityArea.trim() : "";
  const goalDescription = typeof body.goalDescription === "string" ? body.goalDescription.trim() : "";
  if (!academicYear || !priorityArea || !goalDescription) {
    return NextResponse.json(
      { error: "Academic year, priority area, and goal description are required." },
      { status: 400 }
    );
  }
  if (!(STRATEGIC_PRIORITY_AREAS as readonly string[]).includes(priorityArea)) {
    return NextResponse.json({ error: "Invalid priority area." }, { status: 400 });
  }
  const period = typeof body.period === "string" && isPlanPeriod(body.period) ? body.period : "YEAR";
  const responsibleOfficer = typeof body.responsibleOfficer === "string" ? body.responsibleOfficer.trim() || null : null;
  const targetTimeline = typeof body.targetTimeline === "string" ? body.targetTimeline.trim() || null : null;

  const goal = await prisma.strategicPlanGoal.create({
    data: { academicYear, period, priorityArea, goalDescription, responsibleOfficer, targetTimeline },
  });
  return NextResponse.json(goal, { status: 201 });
}
