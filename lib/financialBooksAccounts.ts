// The "Expenses" half of the chapter's own chart of accounts — read
// directly off the "Accounts" sheet of the real Financial Books workbook
// (Upd. SON Drive 8.8.26/2025-2026 G.2. Financial Books.xlsx), not
// retyped from memory. Used to categorize each Budget line item with the
// same code the Treasurer would use when it eventually gets logged as a
// real transaction. Code 219 is genuinely missing from the chapter's own
// sheet (skipped between 218 and 220) — not an error here.
export interface ExpenseAccount {
  code: number;
  label: string;
}

export const EXPENSE_ACCOUNTS: ExpenseAccount[] = [
  { code: 200, label: "National Board Dues" },
  { code: 201, label: "Pledge Class Costs" },
  { code: 202, label: "Recruitment Expenses" },
  { code: 203, label: "Council Dues" },
  { code: 204, label: "Socials/Retreats" },
  { code: 205, label: "Banking Fees" },
  { code: 206, label: "Officer Expenses (i.e. Zoom)" },
  { code: 207, label: "Paraphernalia Fundraiser Expenses" },
  { code: 208, label: "Food/Club/Party Fundraiser Sales" },
  { code: 209, label: "Raffles/Auctions Fundraiser Expenses" },
  { code: 210, label: "Other Fundraiser Expenses" },
  { code: 211, label: "Sunnie Summit" },
  { code: 212, label: "Parent's Banquet" },
  { code: 213, label: "Official Sweaters" },
  { code: 214, label: "Graduation Stoles" },
  { code: 215, label: "National Conference" },
  { code: 216, label: "Battle of the Chapters" },
  { code: 217, label: "Executive Retreat" },
  { code: 218, label: "Formal Payments" },
  { code: 220, label: "Scholarships" },
  { code: 221, label: "Philanthropy & Community Service" },
];

export function expenseAccountLabel(code: number | null): string | null {
  if (code == null) return null;
  return EXPENSE_ACCOUNTS.find((a) => a.code === code)?.label ?? null;
}

export function isExpenseAccountCode(value: number): boolean {
  return EXPENSE_ACCOUNTS.some((a) => a.code === value);
}

// The "Revenue" half of the same "Accounts" sheet, columns A/B rather
// than D/E — read the same way, straight off the real workbook, not
// retyped from memory. 103-106 and 120 are genuinely missing from the
// chapter's own sheet (same kind of gap as Expense code 219), not an
// error here.
export const INCOME_ACCOUNTS: ExpenseAccount[] = [
  { code: 100, label: "Membership Dues" },
  { code: 101, label: "Pledge Class Dues" },
  { code: 102, label: "Fines" },
  { code: 107, label: "Paraphernalia Fundraiser Sales" },
  { code: 108, label: "Food/Club/Party Fundraiser Sales" },
  { code: 109, label: "Raffles/Auctions Fundraiser Sales" },
  { code: 110, label: "Other Fundraiser Sales" },
  { code: 111, label: "Sunnie Summit" },
  { code: 112, label: "Parent's Banquet" },
  { code: 113, label: "Official Sweaters" },
  { code: 114, label: "Graduation Stoles" },
  { code: 115, label: "National Conference" },
  { code: 116, label: "Battle of the Chapters" },
  { code: 117, label: "Executive Retreat" },
  { code: 118, label: "Formal Payments" },
  { code: 119, label: "Donations" },
  { code: 121, label: "Philanthropy & Community Service" },
];

export function incomeAccountLabel(code: number | null): string | null {
  if (code == null) return null;
  return INCOME_ACCOUNTS.find((a) => a.code === code)?.label ?? null;
}

export function isIncomeAccountCode(value: number): boolean {
  return INCOME_ACCOUNTS.some((a) => a.code === value);
}
