import { calculateChapterBalance } from "@/lib/chapterBalance";
import { formatCurrency } from "@/lib/fines";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { FinancesClient } from "./FinancesClient";
import { ChapterAccountLedgerSection } from "./ChapterAccountLedgerSection";

export default async function FinancesPage() {
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

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Chapter Finances</h1>
        </div>
        <a
          href="/api/finances/export"
          className="shrink-0 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Export Financial Books
        </a>
      </div>
      <p className="mt-1 text-xs text-stone-400">
        Downloads the chapter&apos;s real Financial Books workbook with its
        &quot;Budget Log&quot; sheet filled in from every <em>approved</em>
        Final Budget above — safe to click anytime, it never touches the
        sheet&apos;s existing rows or duplicates one on repeat downloads.
      </p>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4 sm:max-w-xs">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Current Chapter Balance</p>
        <p className={`mt-1 text-2xl font-semibold ${chapterBalance < 0 ? "text-red-600" : "text-stone-900"}`}>
          {formatCurrency(chapterBalance)}
        </p>
        <p className="mt-1 text-xs text-stone-400">
          {startingBalances[0]
            ? `${startingBalances[0].year} starting balance + funds added − approved Final Budgets`
            : "No starting balance set yet — funds added − approved Final Budgets"}
        </p>
      </div>

      <div className="mt-6">
        <FinancesClient initialBudgets={budgets} />
      </div>

      <div className="mt-8">
        <ChapterAccountLedgerSection initialStartingBalances={startingBalances} initialFundEntries={fundEntries} />
      </div>
    </div>
  );
}
