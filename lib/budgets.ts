// Shared budget constants + math — used by both the API routes
// (validation) and the UI. Kept as a plain string union instead of a
// Prisma enum for the same reason as roster status: SQLite has no
// native enum type.

export const BUDGET_STAGES = ["TENTATIVE", "FINAL"] as const;

export type BudgetStage = (typeof BUDGET_STAGES)[number];

export const BUDGET_STAGE_LABELS: Record<BudgetStage, string> = {
  TENTATIVE: "Tentative",
  FINAL: "Final",
};

export function isBudgetStage(value: string): value is BudgetStage {
  return (BUDGET_STAGES as readonly string[]).includes(value);
}

// Budget.eventDate is stored as whatever the date picker hands over —
// ISO "YYYY-MM-DD" — but that's an ugly thing to show in a list, so
// display it locale-formatted instead. Older budgets created before the
// picker existed may still have free-text dates in other shapes; those
// just get shown as-is rather than mangled.
export function formatEventDate(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Only used by the "Chapter Budget Log" columns (see
// lib/financialBooksExport.ts) — the chapter's own budget template has
// no equivalent of either of these.
export const BUDGET_LOG_STATUSES = ["Pending", "Passed", "Failed", "Tabled"] as const;
export type BudgetLogStatus = (typeof BUDGET_LOG_STATUSES)[number];

// A Final Budget is "in limbo" — visible and editable, but doesn't count
// toward Chapter Finances' totals and doesn't get included in the
// Financial Books export — until this is true. Deliberately just the one
// field: nothing else (tax rate, line items) gates it. See
// app/(app)/finances/page.tsx and app/api/finances/export/route.ts,
// which both filter on this before doing anything else.
export function isApprovedVersion(version: { status: string | null }): boolean {
  return version.status === "Passed";
}

export const REIMBURSEMENT_METHODS = [
  "Cashapp",
  "Venmo",
  "Zelle",
  "PayPal",
  "Cash",
  "Check",
  "Other",
] as const;
export type ReimbursementMethod = (typeof REIMBURSEMENT_METHODS)[number];

// Mirrors the spreadsheet's own math (Templates/Copy of SON Expense
// Budget.xlsx): Subtotal = sum of every line item's qty * price. Tax is
// the sales tax rate applied only to line items marked taxable (the
// sheet has you compute this by hand; here it's automatic). Total =
// Subtotal + Tax.
export interface BudgetLineItemLike {
  quantity: number;
  price: number;
  taxable: boolean;
}

export function lineItemTotal(item: BudgetLineItemLike): number {
  return item.quantity * item.price;
}

export function calculateBudgetTotals(lineItems: BudgetLineItemLike[], salesTaxRate: number) {
  const subtotal = lineItems.reduce((sum, item) => sum + lineItemTotal(item), 0);
  const tax = lineItems
    .filter((item) => item.taxable)
    .reduce((sum, item) => sum + lineItemTotal(item) * salesTaxRate, 0);
  const total = subtotal + tax;

  return { subtotal, tax, total };
}
