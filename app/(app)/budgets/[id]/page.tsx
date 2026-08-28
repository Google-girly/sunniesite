import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BudgetOverviewClient } from "./BudgetOverviewClient";

export default async function BudgetOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: { versions: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } } },
  });

  if (!budget) {
    notFound();
  }

  return <BudgetOverviewClient initialBudget={budget} />;
}
