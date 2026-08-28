import { prisma } from "@/lib/prisma";
import { BudgetsClient } from "./BudgetsClient";

export default async function BudgetsPage() {
  const budgets = await prisma.budget.findMany({
    include: { versions: { include: { lineItems: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">
        Budgets &amp; Reimbursements
      </h1>

      <div className="mt-6">
        <BudgetsClient initialBudgets={budgets} />
      </div>
    </div>
  );
}
