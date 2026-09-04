import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import type { Budget, BudgetLineItem, BudgetVersion, ChapterFundEntry, ChapterStartingBalance } from "@/app/generated/prisma/client";
import { calculateBudgetTotals, lineItemTotal } from "@/lib/budgets";
import {
  type CellEdit,
  cellHasValue,
  patchCell,
  patchCells,
  readEntry,
  resolveSheetPath,
  forceFullCalcOnLoad,
} from "@/lib/xlsxPatch";
import {
  recalcCheckbookFormulas,
  recalcIncStmtFormulas,
  recalcSummaryFormulas,
} from "@/lib/financialBooksRecalc";

type VersionWithItems = BudgetVersion & { lineItems: BudgetLineItem[] };
export type FinalBudgetEntry = { budget: Budget; version: VersionWithItems };

// One line for the Checkbook sheet, already resolved to either a
// Withdraw (expense, column F) or Deposit (income, column G) — built
// from both Final Budgets (via groupLineItemsByAccountCode) and
// ChapterFundEntry rows, then interleaved by date so the sheet reads as
// one real chronological ledger instead of "all the expenses, then all
// the deposits."
interface CheckbookTransaction {
  date: string;
  paymentMethod: string | null;
  kind: "Withdraw" | "Deposit";
  description: string;
  code: number | null;
  amount: number;
}

const TEMPLATE_PATH = path.join(process.cwd(), "lib/templates/financial-books-template.xlsx");

// Budget Log's real header row (row 5) plus the chapter's own hand-entered
// history start at row 8 — see the sheet dump in project notes. Every row
// from there on already exists in the template pre-styled (blank, but
// with the right borders/number formats), all the way past row 900, so
// there's never a need to *insert* rows — only to fill in whichever ones
// are still blank. That also means this is safe to run from scratch every
// time: it always starts from the same template, always finds the same
// first-blank-row, and always writes the same deterministic rows for
// whatever's currently in the database — repeat exports never duplicate
// anything or disturb the chapter's real hand-entered rows above them.
const FIRST_DATA_ROW = 8;
const MAX_ROW = 900;

// Checkbook's row 9 is "Starting Balance" (a hand-entered anchor for the
// running-balance formula every row below it chains off — see
// CHECKBOOK_MAX_ROW below) rather than a transaction, so real entries
// start one row later than Budget Log's. Every row from here down
// already carries a pre-styled Balance formula (column H) referencing
// the row above it, all the way past row 500 — same "never insert rows,
// only fill in blank ones" approach as Budget Log.
const CHECKBOOK_FIRST_DATA_ROW = 10;
const CHECKBOOK_MAX_ROW = 500;

// Fills the "Budget Log" sheet of the chapter's real Financial Books
// workbook (Upd. SON Drive 8.8.26/2025-2026 G.2. Financial Books.xlsx) —
// same surgical-XML-edit approach as lib/budgetExport.ts (see its top
// comment for why): find the template's own blank cells and write values
// into them, touching nothing else in the file. Only Final Budgets are
// written — a Tentative Budget isn't a real expense yet, and the Budget
// Log is a record of what was actually submitted/paid.
export async function buildFinancialBooksWorkbook(
  entries: FinalBudgetEntry[],
  fundEntries: ChapterFundEntry[] = [],
  startingBalance: ChapterStartingBalance | null = null
): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const sheetPath = await resolveSheetPath(zip, "Budget Log");
  let sheetXml = await readEntry(zip, sheetPath);

  let row = FIRST_DATA_ROW;
  while (row < MAX_ROW && cellHasValue(sheetXml, `A${row}`)) row++;

  // Oldest-first, so the log reads in the order things actually happened.
  const sorted = [...entries].sort(
    (a, b) => a.budget.createdAt.getTime() - b.budget.createdAt.getTime()
  );

  for (const { budget, version } of sorted) {
    if (row >= MAX_ROW) break; // template's out of pre-styled rows; stop rather than guess new ones

    const totals = calculateBudgetTotals(version.lineItems, version.salesTaxRate);
    const edits: CellEdit[] = [
      { ref: `A${row}`, value: numericOrText(budget.budgetNumber) },
      { ref: `B${row}`, value: "Final" },
      { ref: `C${row}`, value: version.submittedBy },
      { ref: `D${row}`, value: version.dateDue },
      { ref: `E${row}`, value: version.dateSubmitted },
      { ref: `F${row}`, value: version.datePresented },
      { ref: `G${row}`, value: budget.eventName },
      { ref: `H${row}`, value: round2(totals.total) },
      { ref: `I${row}`, value: version.checkNumber },
      { ref: `J${row}`, value: version.vote },
      { ref: `K${row}`, value: version.status },
      { ref: `L${row}`, value: reimbursementText(version) },
    ];
    sheetXml = patchCells(sheetXml, edits);
    row++;
  }

  zip.file(sheetPath, sheetXml);

  // Also log every real cash movement into the Checkbook sheet — one row
  // per expense-account code used per budget (see
  // lib/financialBooksAccounts.ts) rather than one row per budget, since
  // a real check often covers several categories at once and
  // Checkbook's own "Code" column only ever holds one code per row (see
  // groupLineItemsByAccountCode below); plus one row per ChapterFundEntry
  // (a deposit — dues, fundraiser income, etc., categorized the same way
  // via INCOME_ACCOUNTS). Both kinds get merged into one list and sorted
  // by date so the sheet reads as a real chronological ledger, not
  // "every expense, then every deposit." Line items with no category
  // get grouped under a blank Code rather than silently dropped, so each
  // budget's rows always sum to its real total.
  const checkbookPath = await resolveSheetPath(zip, "Checkbook");
  let checkbookXml = await readEntry(zip, checkbookPath);

  // Row 9 is "Starting Balance" (see CHECKBOOK_FIRST_DATA_ROW's comment)
  // — H9 is its Balance cell, left blank in the template until the
  // Treasurer sets one. forceFullCalcOnLoad below recomputes every row's
  // running-balance formula off of it when the file opens.
  if (startingBalance) {
    checkbookXml = patchCell(checkbookXml, "H9", round2(startingBalance.amount));
  }

  const transactions: CheckbookTransaction[] = [];
  for (const { budget, version } of sorted) {
    const groups = groupLineItemsByAccountCode(version.lineItems, version.salesTaxRate);
    const date = version.dateReceived ?? version.dateDue ?? budget.eventDate ?? "";
    for (const group of groups) {
      transactions.push({
        date,
        paymentMethod: version.reimbursementMethod,
        kind: "Withdraw",
        description: budget.eventName,
        code: group.code,
        amount: group.amount,
      });
    }
  }
  for (const fund of fundEntries) {
    transactions.push({
      date: fund.date,
      paymentMethod: null,
      kind: "Deposit",
      description: fund.description,
      code: fund.accountCode,
      amount: fund.amount,
    });
  }
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  let checkbookRow = CHECKBOOK_FIRST_DATA_ROW;
  while (checkbookRow < CHECKBOOK_MAX_ROW && cellHasValue(checkbookXml, `A${checkbookRow}`)) {
    checkbookRow++;
  }

  for (const tx of transactions) {
    if (checkbookRow >= CHECKBOOK_MAX_ROW) break; // out of pre-styled rows; stop rather than guess new ones

    const edits: CellEdit[] = [
      { ref: `A${checkbookRow}`, value: tx.date },
      { ref: `B${checkbookRow}`, value: tx.paymentMethod },
      { ref: `C${checkbookRow}`, value: tx.kind },
      { ref: `D${checkbookRow}`, value: tx.description },
      { ref: `E${checkbookRow}`, value: tx.code },
      // F (Debit/Withdraw) or G (Credit/Deposit) — never both. H
      // (Balance) is a pre-existing formula, untouched.
      { ref: tx.kind === "Withdraw" ? `F${checkbookRow}` : `G${checkbookRow}`, value: round2(tx.amount) },
    ];
    checkbookXml = patchCells(checkbookXml, edits);
    checkbookRow++;
  }

  // Recompute the cross-sheet formula chain (Checkbook -> IncStmt ->
  // Summary) and bake the real results into each formula cell's cached
  // <v>, rather than trusting Excel's on-open recalc to fill them in —
  // see the top comment in lib/financialBooksRecalc.ts for why.
  checkbookXml = recalcCheckbookFormulas(checkbookXml);
  zip.file(checkbookPath, checkbookXml);

  const incStmtPath = await resolveSheetPath(zip, "IncStmt");
  const incStmtXml = recalcIncStmtFormulas(await readEntry(zip, incStmtPath), checkbookXml);
  zip.file(incStmtPath, incStmtXml);

  const summaryPath = await resolveSheetPath(zip, "Summary");
  const summaryXml = recalcSummaryFormulas(await readEntry(zip, summaryPath), incStmtXml);
  zip.file(summaryPath, summaryXml);

  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  zip.file("xl/workbook.xml", forceFullCalcOnLoad(workbookXml));

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function financialBooksExportFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `financial-books-${today}.xlsx`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Budget numbers are assigned by hand and stored as free text, but the
// sheet's own rows use real numbers for that column — write a number
// when the value parses cleanly as one, text otherwise.
function numericOrText(value: string | null): string | number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function reimbursementText(version: BudgetVersion): string | null {
  if (!version.reimbursementMethod) return null;
  const amount = version.checkAmount;
  return amount != null
    ? `${version.reimbursementMethod} - $${round2(amount)}`
    : version.reimbursementMethod;
}

// Buckets a Final Budget's line items by expense-account code, summing
// each bucket's real cost (quantity * price, plus that item's own share
// of tax if it's taxable — same per-item math the Final Budget sheet
// itself uses). Uncategorized items land in one `code: null` bucket
// rather than being dropped, so a budget's Checkbook rows always add up
// to its real total even if the chair never got around to categorizing
// everything. Sorted by code ascending, uncategorized last, so the
// output order is deterministic across repeat exports.
function groupLineItemsByAccountCode(
  lineItems: BudgetLineItem[],
  salesTaxRate: number
): { code: number | null; amount: number }[] {
  const totals = new Map<number | null, number>();
  for (const item of lineItems) {
    const base = lineItemTotal(item);
    const withTax = item.taxable ? base + base * salesTaxRate : base;
    totals.set(item.accountCode, (totals.get(item.accountCode) ?? 0) + withTax);
  }

  return [...totals.entries()]
    .map(([code, amount]) => ({ code, amount }))
    .sort((a, b) => {
      if (a.code === null) return 1;
      if (b.code === null) return -1;
      return a.code - b.code;
    });
}
