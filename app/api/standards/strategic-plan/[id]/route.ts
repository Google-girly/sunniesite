import { NextResponse } from "next/server";
import { STRATEGIC_GOAL_STATUSES } from "@/lib/standardsForms";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH exists separately from the rest of Standards Forms' add/delete-only
// convention because §F.5's whole point is updating the *same* goal's
// progress by 1/31 — status/progress notes need editing in place, not
// removing and re-adding a goal (which would lose the original plan).
export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const data: { status?: string; progressNotes?: string | null } = {};
  if (typeof body.status === "string") {
    if (!(STRATEGIC_GOAL_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (typeof body.progressNotes === "string") {
    data.progressNotes = body.progressNotes.trim() || null;
  }

  try {
    const goal = await prisma.strategicPlanGoal.update({ where: { id }, data });
    return NextResponse.json(goal);
  } catch {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.strategicPlanGoal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 });
  }
}
