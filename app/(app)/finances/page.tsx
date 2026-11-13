import { calculateBudgetTotals, isApprovedVersion } from "@/lib/budgets";
import { calculateBalanceSplit, calculateChapterBalance } from "@/lib/chapterBalance";
import { formatCurrency } from "@/lib/fines";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { FinancesClient } from "./FinancesClient";
import { FundEntrySection, StartingBalanceSection } from "./ChapterAccountLedgerSection";
import { FinancesTabs } from "./FinancesTabs";

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { allowed } = await requirePageAccess("finances");
  if (!allowed) return <NotAuthorized moduleTitle="Chapter Finances" positions={["Treasurer"]} />;

  // No dedicated table for this — it's a live rollup of every event's
  // Final Budget. Nothing to "import": as soon as a Final Budget exists
  // (see app/(app)/budgets/[id]/final/), it shows up here automatically.
  // "Edit" links back into Budgets & Reimbursements rather than editing
  // in place here — this page is a dashboard over that module, not a
  // second copy of its editor. See MODULES.md.
  const [budgets, startingBalances, fundEntries] = await Promise.all([
    prisma.budget.findMany({
      include: {
        versions: {
          where: { stage: "FINAL" },
          include: { lineItems: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.chapterStartingBalance.findMany({ orderBy: { year: "desc" } }),
    prisma.chapterFundEntry.findMany({ orderBy: { date: "desc" } }),
  ]);

  // Same starting-balance + deposits - approved-Final-Budgets math the
  // meeting minutes export uses (lib/chapterBalance.ts). The client
  // sections router.refresh() after every change so this stays current.
  const finalBudgets = budgets
    .filter((b) => b.versions.length > 0)
    .map((b) => ({ budget: b, version: b.versions[0] }));
  const chapterBalance = calculateChapterBalance(finalBudgets, fundEntries, startingBalances[0] ?? null);
  const split = calculateBalanceSplit(finalBudgets, fundEntries, startingBalances[0] ?? null);

  // The same three pieces calculateChapterBalance adds up, shown on the
  // balance card so the number isn't a black box.
  const startingAmount = startingBalances[0]?.amount ?? 0;
  const fundsAdded = fundEntries.reduce((sum, f) => sum + f.amount, 0);
  const approvedSpent = finalBudgets
    .filter(({ version }) => isApprovedVersion(version))
    .reduce((sum, { version }) => sum + calculateBudgetTotals(version.lineItems, version.salesTaxRate).total, 0);
  const awaitingApproval = finalBudgets.filter(({ version }) => !isApprovedVersion(version)).length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Chapter Finances</h1>
          <p className="mt-1 text-sm text-stone-500">
            What came in, what went out, and what the chapter has left.
          </p>
        </div>
        <a
          href="/api/finances/export"
          title="Downloads the chapter's Financial Books workbook with its Budget Log filled in from every approved Final Budget. Safe to download as often as you like — it never duplicates rows."
          className="shrink-0 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Export Financial Books
        </a>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Current Chapter Balance</p>
          <p className={`mt-1 text-3xl font-semibold ${chapterBalance < 0 ? "text-red-600" : "text-stone-900"}`}>
            {formatCurrency(chapterBalance)}
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">
                Starting balance{startingBalances[0] ? ` (${startingBalances[0].year})` : ""}
              </dt>
              <dd className="text-stone-700">{startingBalances[0] ? formatCurrency(startingAmount) : "Not set"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">+ Funds added</dt>
              <dd className="text-green-700">{formatCurrency(fundsAdded)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">− Approved spending</dt>
              <dd className="text-red-700">{formatCurrency(approvedSpent)}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Pledge Class Money</p>
            <p className={`mt-1 text-2xl font-semibold ${split.pledge.balance < 0 ? "text-red-600" : "text-stone-900"}`}>
              {formatCurrency(split.pledge.balance)}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              {formatCurrency(split.pledge.dues)} Pledge Class Dues (101) − {formatCurrency(split.pledge.spent)} spent on
              Pledge Class Costs (201)
            </p>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Regular Chapter Money</p>
            <p className={`mt-1 text-2xl font-semibold ${split.regular.balance < 0 ? "text-red-600" : "text-stone-900"}`}>
              {formatCurrency(split.regular.balance)}
            </p>
            <p className="mt-1 text-xs text-stone-400">Everything in the chapter balance that isn&apos;t pledge class money</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <FinancesTabs
          awaitingApproval={awaitingApproval}
          initialTab={(await searchParams).tab}
          tabs={[
            {
              id: "money-in",
              label: "Money In",
              content: <FundEntrySection initial={fundEntries} />,
            },
            {
              id: "money-out",
              label: "Money Out",
              badge: awaitingApproval,
              content: <FinancesClient initialBudgets={budgets} />,
            },
            {
              id: "starting-balance",
              label: "Starting Balance",
              content: <StartingBalanceSection initial={startingBalances} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
