import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBudgetStage } from "@/lib/budgets";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Creates the Tentative or Final budget under an event. A budget has at
// most one of each (see the @@unique in schema.prisma) — trying to
// create a second one for the same stage is a 409, not a silent
// duplicate.
export async function POST(request: Request, { params }: RouteParams) {
  const { id: budgetId } = await params;
  const body = await request.json().catch(() => null);
  const stage = typeof body?.stage === "string" ? body.stage : "";

  if (!isBudgetStage(stage)) {
    return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
  }

  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget) {
    return NextResponse.json({ error: "Budget not found." }, { status: 404 });
  }

  const existing = await prisma.budgetVersion.findUnique({
    where: { budgetId_stage: { budgetId, stage } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `This budget already has a ${stage.toLowerCase()} version.` },
      { status: 409 }
    );
  }

  const version = await prisma.budgetVersion.create({
    data: { budgetId, stage },
    include: { lineItems: true },
  });

  return NextResponse.json(version, { status: 201 });
}
