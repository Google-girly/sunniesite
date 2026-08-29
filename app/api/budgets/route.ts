import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";
import { addActionItemToNextMeeting } from "@/lib/meetingMinutesAutoAdd";

export async function GET() {
  const budgets = await prisma.budget.findMany({
    include: { versions: { include: { lineItems: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(budgets);
}

export async function POST(request: Request) {
  const access = await requireApiAccess("budgets");
  if ("error" in access) return access.error;
  const { member } = access;

  const body = await request.json().catch(() => null);
  const eventName = typeof body?.eventName === "string" ? body.eventName.trim() : "";
  const chair = typeof body?.chair === "string" ? body.chair.trim() : "";
  const eventDate = typeof body?.eventDate === "string" ? body.eventDate.trim() : "";

  if (!eventName) {
    return NextResponse.json({ error: "Event name is required." }, { status: 400 });
  }
  if (!chair) {
    return NextResponse.json({ error: "Chair is required." }, { status: 400 });
  }
  if (!eventDate) {
    return NextResponse.json({ error: "Date of Event is required." }, { status: 400 });
  }

  const budget = await prisma.budget.create({
    data: { eventName, chair, eventDate, budgetNumber: await nextBudgetNumber() },
    include: { versions: { include: { lineItems: true } } },
  });

  // Aug 2026 — "when a budget is submitted it should automatically go
  // with the next meeting, as long as it is not within 24 hrs and 5 min
  // of the meeting." Set once, here at creation — a later Final Budget
  // version submitted for this same event doesn't add a second entry.
  // Best-effort: a submitted budget is real either way, so this
  // shouldn't fail the request if it doesn't find a meeting to attach to.
  const added = await addActionItemToNextMeeting(
    `${eventName} — Tentative Budget submitted (Chair: ${chair})`,
    { id: member.id, name: chair }
  );
  if (added) {
    await prisma.budget.update({ where: { id: budget.id }, data: { addedToMeetingId: added.meetingId } });
    budget.addedToMeetingId = added.meetingId;
  }

  return NextResponse.json(budget, { status: 201 });
}

// One higher than the largest number already assigned. Budget numbers
// are stored as free text (some very old ones could in principle be
// non-numeric), so this reads every existing one rather than trying to
// sort/aggregate them as strings — "10" sorts before "9" lexically,
// which would be wrong. Fine at chapter scale (tens of budgets a year,
// not thousands). Note this only looks at budgets that still exist: if
// the highest-numbered one is ever deleted, the next one created reuses
// that number rather than skipping past it — acceptable for a small
// internal tool, but worth knowing if it ever matters.
async function nextBudgetNumber(): Promise<string> {
  const existing = await prisma.budget.findMany({ select: { budgetNumber: true } });
  const max = existing.reduce((highest, b) => {
    const n = b.budgetNumber ? parseInt(b.budgetNumber, 10) : NaN;
    return Number.isFinite(n) && n > highest ? n : highest;
  }, 0);
  return String(max + 1);
}
