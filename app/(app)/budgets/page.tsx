import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { BudgetsClient } from "./BudgetsClient";

// Aug 2026: previously ungated (every "open-submit" module was — see
// lib/permissions.ts's four-pattern comment), now checked for real
// since GENERAL-status, no-position members are meant to be turned
// away from everything except Calendar/Meeting Minutes/Letters.
export default async function BudgetsPage() {
  const { allowed } = await requirePageAccess("budgets");
  if (!allowed) {
    return <NotAuthorized moduleTitle="Budgets & Reimbursements" positions={["Treasurer"]} />;
  }

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
