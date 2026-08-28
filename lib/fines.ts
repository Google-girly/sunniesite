// Shared Member Accounts / Fines constants + math — used by both the API
// routes (validation) and the UI.
//
// The fine schedule below is Chapter Standing Rules Article VII, current
// as of the 07-2026 revision. One line item disagrees between documents:
// bounced checks are $25-or-the-bank's-fee in Standing Rules but a flat
// $10 in Chapter Bylaws Article XIII §E — confirmed with the chapter that
// the $10 flat fee is the one actually enforced, so that's what's here.
export interface FineScheduleItem {
  code: string;
  category: string;
  label: string;
  amount: number;
}

export const FINE_SCHEDULE: FineScheduleItem[] = [
  // Meetings
  {
    code: "meeting-unexcused-absence",
    category: "Meetings",
    label: "Unexcused absence",
    amount: 10,
  },
  {
    code: "meeting-late-1-5",
    category: "Meetings",
    label: "Arriving late / leaving early — first 5 min",
    amount: 1,
  },
  {
    code: "meeting-late-6-10",
    category: "Meetings",
    label: "Arriving late / leaving early — 6–10 min",
    amount: 2,
  },
  {
    code: "meeting-late-10-plus",
    category: "Meetings",
    label: "Arriving late / leaving early — 10+ min",
    amount: 5,
  },
  { code: "meeting-no-binder", category: "Meetings", label: "No binder", amount: 5 },
  {
    code: "meeting-attire",
    category: "Meetings",
    label: "Non-professional attire",
    amount: 5,
  },
  // Activities or Events
  {
    code: "event-unexcused-absence",
    category: "Activities or Events",
    label: "Unexcused absence",
    amount: 10,
  },
  { code: "event-late", category: "Activities or Events", label: "Arriving late", amount: 5 },
  {
    code: "event-no-letter",
    category: "Activities or Events",
    label: "Failure to submit a letter",
    amount: 5,
  },
  {
    code: "event-no-explanation",
    category: "Activities or Events",
    label: "Failure to explain delinquency / arrange payment within 7 days",
    amount: 10,
  },
  // Payment of Dues
  {
    code: "dues-no-payment-no-contract",
    category: "Payment of Dues",
    label: "No payment & no contract at first General Meeting",
    amount: 8,
  },
  {
    code: "dues-missed-payment",
    category: "Payment of Dues",
    label: "Missed (contract) payment",
    amount: 5,
  },
  {
    code: "dues-late-charge",
    category: "Payment of Dues",
    label: "Late charge",
    amount: 5,
  },
  // Checks
  { code: "bounced-check", category: "Checks", label: "Bounced check", amount: 10 },
  // Missed Deadlines
  { code: "missed-deadline", category: "Missed Deadlines", label: "Any deadline", amount: 5 },
];

export function findFine(code: string): FineScheduleItem | undefined {
  return FINE_SCHEDULE.find((f) => f.code === code);
}

// Groups FINE_SCHEDULE by category, preserving the order categories first
// appear in — used to render the Add Fine dropdown as <optgroup>s.
export function groupFinesByCategory(): { category: string; fines: FineScheduleItem[] }[] {
  const groups: { category: string; fines: FineScheduleItem[] }[] = [];
  for (const fine of FINE_SCHEDULE) {
    let group = groups.find((g) => g.category === fine.category);
    if (!group) {
      group = { category: fine.category, fines: [] };
      groups.push(group);
    }
    group.fines.push(fine);
  }
  return groups;
}

export const ENTRY_TYPES = ["DUES", "FINE", "PAYMENT", "CREDIT"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  DUES: "Dues",
  FINE: "Fine",
  PAYMENT: "Payment",
  CREDIT: "Credit",
};

export function isEntryType(value: string): value is EntryType {
  return (ENTRY_TYPES as readonly string[]).includes(value);
}

// Dues and Fines increase what a member owes; Payments and Credits
// (see Chapter Standing Rules Article X — surplus fundraising becomes a
// credit on a member's account, usable to pay off dues or fines) reduce
// it.
const CHARGE_TYPES: readonly EntryType[] = ["DUES", "FINE"];

export function isChargeType(type: EntryType): boolean {
  return CHARGE_TYPES.includes(type);
}

export interface AccountEntryLike {
  type: string;
  amount: number;
}

// Positive balance = money owed to the Chapter; zero or negative = paid
// up (negative meaning a credit surplus sits on file, per Article X).
export function calculateBalance(entries: AccountEntryLike[]): number {
  return entries.reduce((sum, entry) => {
    if (!isEntryType(entry.type)) return sum;
    return sum + (isChargeType(entry.type) ? entry.amount : -entry.amount);
  }, 0);
}

export function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
