import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: { versions: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!budget) {
    return NextResponse.json({ error: "Budget not found." }, { status: 404 });
  }
  return NextResponse.json(budget);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // budgetNumber isn't here — it's assigned automatically at creation
  // (see nextBudgetNumber() in app/api/budgets/route.ts) and never
  // changes after that, so there's nothing for this route to accept.
  const data: {
    eventName?: string;
    chair?: string;
    eventDate?: string;
  } = {};

  if (typeof body.eventName === "string") {
    const eventName = body.eventName.trim();
    if (!eventName) {
      return NextResponse.json({ error: "Event name is required." }, { status: 400 });
    }
    data.eventName = eventName;
  }
  if (typeof body.chair === "string") {
    const chair = body.chair.trim();
    if (!chair) {
      return NextResponse.json({ error: "Chair is required." }, { status: 400 });
    }
    data.chair = chair;
  }
  if (typeof body.eventDate === "string") {
    const eventDate = body.eventDate.trim();
    if (!eventDate) {
      return NextResponse.json({ error: "Date of Event is required." }, { status: 400 });
    }
    data.eventDate = eventDate;
  }

  try {
    const budget = await prisma.budget.update({
      where: { id },
      data,
      include: { versions: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } } },
    });
    return NextResponse.json(budget);
  } catch {
    return NextResponse.json({ error: "Budget not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    await prisma.budget.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Budget not found." }, { status: 404 });
  }
}
