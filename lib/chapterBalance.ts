// The chapter's actual current account balance — reused by the Meeting
// Minutes export (Sept 2026 — "auto add the chapter's balance to the
// treasurer's report where it asks", the "Chapter Balance: ___" line new
// to the National Meeting Agenda/Minutes template) since a .docx has no
// formula engine to lean on the way lib/financialBooksExport.ts's
// Checkbook sheet does (that one bakes the starting balance into H9 and
// lets Excel's own running-balance formula do the math on open — see its
// own comments). Same three ingredients, computed here in plain JS
// instead: the most recent year's ChapterStartingBalance, plus every
// ChapterFundEntry deposit, minus every *approved* Final Budget's total
// (isApprovedVersion — a Final Budget still "in limbo" doesn't count
// toward this any more than it counts toward Chapter Finances' own
// totals or the Financial Books export; see app/api/finances/export's
// identical filter).
import type { Budget, BudgetLineItem, BudgetVersion, ChapterFundEntry, ChapterStartingBalance } from "@/app/generated/prisma/client";
import { calculateBudgetTotals, isApprovedVersion } from "@/lib/budgets";

type VersionWithItems = BudgetVersion & { lineItems: BudgetLineItem[] };
export type FinalBudgetEntry = { budget: Budget; version: VersionWithItems };

export function calculateChapterBalance(
  finalBudgets: FinalBudgetEntry[],
  fundEntries: Pick<ChapterFundEntry, "amount">[],
  startingBalance: Pick<ChapterStartingBalance, "amount"> | null
): number {
  const starting = startingBalance?.amount ?? 0;
  const deposits = fundEntries.reduce((sum, f) => sum + f.amount, 0);
  const spent = finalBudgets
    .filter(({ version }) => isApprovedVersion(version))
    .reduce((sum, { version }) => sum + calculateBudgetTotals(version.lineItems, version.salesTaxRate).total, 0);
  return starting + deposits - spent;
}
