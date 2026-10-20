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

// Oct 2026 — "see how much is pledge class dues vs regular sorority
// money." No separate account exists for the pledge class; the split comes
// from the account codes already on every entry (lib/financialBooksAccounts.ts):
// fund entries coded 101 Pledge Class Dues minus approved Final Budget line
// items coded 201 Pledge Class Costs (sales tax included for taxable
// items) is the pledge class's money. Everything else, including the
// starting balance, is regular chapter money. The two always add up to
// calculateChapterBalance.
export const PLEDGE_DUES_ACCOUNT = 101;
export const PLEDGE_COSTS_ACCOUNT = 201;

export type BalanceSplit = {
  pledge: { dues: number; spent: number; balance: number };
  regular: { balance: number };
};

export function calculateBalanceSplit(
  finalBudgets: FinalBudgetEntry[],
  fundEntries: Pick<ChapterFundEntry, "amount" | "accountCode">[],
  startingBalance: Pick<ChapterStartingBalance, "amount"> | null
): BalanceSplit {
  const dues = fundEntries
    .filter((f) => f.accountCode === PLEDGE_DUES_ACCOUNT)
    .reduce((sum, f) => sum + f.amount, 0);
  const spent = finalBudgets
    .filter(({ version }) => isApprovedVersion(version))
    .reduce(
      (sum, { version }) =>
        sum +
        calculateBudgetTotals(
          version.lineItems.filter((item) => item.accountCode === PLEDGE_COSTS_ACCOUNT),
          version.salesTaxRate
        ).total,
      0
    );
  const pledgeBalance = dues - spent;
  const total = calculateChapterBalance(finalBudgets, fundEntries, startingBalance);
  return {
    pledge: { dues, spent, balance: pledgeBalance },
    regular: { balance: total - pledgeBalance },
  };
}
