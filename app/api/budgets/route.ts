import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const budgets = await prisma.budget.findMany({
    include: { versions: { include: { lineItems: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(budgets);
}

export async function POST(request: Request) {
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
