// Recomputes the Financial Books workbook's cross-sheet formula chain —
// Checkbook's running Balance -> IncStmt's per-account SUMIF totals ->
// Summary's VLOOKUPs — and bakes the real results into each formula
// cell's cached <v>, the same fix and for the same reason as
// lib/budgetExport.ts's formulaEdits (see patchFormulaCache's comment in
// lib/xlsxPatch.ts): Excel is supposed to recalculate every formula when
// the file opens, but that isn't reliable in every real Excel install,
// and a stale cached value (usually 0, or last time's numbers) is what
// shows instead when it doesn't.
//
// Rather than hand-reimplementing every one of these formulas from
// memory, each function below reads the *actual* formula text/range out
// of the template at export time (via lib/xlsxPatch.ts's formulaCells/
// cellFormulaText-style helpers) and throws if it's not the shape this
// code expects — so a future edit to the real template (Upd. SON Drive
// 8.8.26/2025-2026 G.2. Financial Books.xlsx) surfaces as a loud export
// failure instead of silently baking in wrong numbers.
//
// Sheets must be recalculated in this order — each reads the *already
// patched* XML of the one before it, not its own re-derivation of that
// sheet's formulas:
//   1. recalcCheckbookFormulas  (self-contained: Balance chains off
//      itself; Total Debit/Credit sum its own F/G columns)
//   2. recalcIncStmtFormulas    (reads Checkbook's now-correct H9/F/G/E)
//   3. recalcSummaryFormulas    (reads IncStmt's now-correct D column)
import {
  type FormulaCacheEdit,
  cellHasFormula,
  formulaCells,
  patchFormulaCaches,
  readCellNumber,
} from "@/lib/xlsxPatch";

const CHECKBOOK_FIRST_DATA_ROW = 10; // keep in sync with lib/financialBooksExport.ts
const CHECKBOOK_MAX_ROW = 900; // generous upper bound — cellHasFormula stops the loop for real

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumColumn(xml: string, col: string, fromRow: number, toRow: number): number {
  let sum = 0;
  for (let row = fromRow; row <= toRow; row++) sum += readCellNumber(xml, `${col}${row}`) ?? 0;
  return sum;
}

export function recalcCheckbookFormulas(xml: string): string {
  // Running Balance (column H): H{row} = H{row-1} + Deposit(G) - Withdraw(F)
  // — see CHECKBOOK_FIRST_DATA_ROW's comment in lib/financialBooksExport.ts.
  // Walk rows until one has no Balance formula at all — the template
  // only pre-fills the chain through a fixed row (currently 325), and
  // rows past that never had a live formula to begin with, recalc or not.
  let balance = readCellNumber(xml, "H9") ?? 0;
  const balanceEdits: FormulaCacheEdit[] = [];
  for (
    let row = CHECKBOOK_FIRST_DATA_ROW;
    row <= CHECKBOOK_MAX_ROW && cellHasFormula(xml, `H${row}`);
    row++
  ) {
    const deposit = readCellNumber(xml, `G${row}`) ?? 0;
    const withdraw = readCellNumber(xml, `F${row}`) ?? 0;
    balance = round2(balance + deposit - withdraw);
    balanceEdits.push({ ref: `H${row}`, value: balance });
  }
  xml = patchFormulaCaches(xml, balanceEdits);

  // Total Debit / Total Credit (F6 / G6): SUM(F#:F#) / SUM(G#:G#) — read
  // the row bounds off F6's own formula text rather than hardcoding them.
  // Real Excel's SUMIF/SUM-range quirk doesn't apply here (this is a
  // plain SUM, not SUMIF), so the range is exactly what the formula says.
  const f6 = formulaCells(xml).find((c) => c.ref === "F6");
  const sumMatch = f6 && /^SUM\(F(\d+):F(\d+)\)$/.exec(f6.body);
  if (!sumMatch) {
    throw new Error(`Checkbook!F6 formula changed from the expected SUM(F#:F#) shape: ${f6?.body}`);
  }
  const [, fromRow, toRow] = sumMatch;
  const totals: FormulaCacheEdit[] = [
    { ref: "F6", value: round2(sumColumn(xml, "F", Number(fromRow), Number(toRow))) },
    { ref: "G6", value: round2(sumColumn(xml, "G", Number(fromRow), Number(toRow))) },
  ];
  return patchFormulaCaches(xml, totals);
}

export function recalcIncStmtFormulas(xml: string, checkbookXml: string): string {
  const values = new Map<string, number>();
  const edits: FormulaCacheEdit[] = [];
  const setValue = (ref: string, value: number) => {
    values.set(ref, value);
    edits.push({ ref, value });
  };

  // Starting Balance passthrough: E7 = Checkbook!H9.
  const e7 = formulaCells(xml).find((c) => c.ref === "E7");
  if (!e7 || e7.body !== "Checkbook!H9") {
    throw new Error(`IncStmt!E7 formula changed from the expected Checkbook!H9 passthrough: ${e7?.body}`);
  }
  setValue("E7", round2(readCellNumber(checkbookXml, "H9") ?? 0));

  // Per-account totals (D column): SUMIF(Checkbook!$E$..:$E$.., <this
  // row's code cell>, Checkbook!$F-or-G$..:$..). Real Excel's SUMIF
  // resizes sum_range to match_range's shape starting from sum_range's
  // *first* cell, ignoring whatever end the formula names (a documented
  // quirk, not a bug) — so only the sum column and its start row matter.
  const sumIfRe =
    /^SUMIF\(Checkbook!\$E\$(\d+):\$E\$(\d+),([A-Z]+\d+),Checkbook!\$([FG])\$(\d+):\$[FG]\$\d+\)$/;
  for (const cell of formulaCells(xml)) {
    const m = sumIfRe.exec(cell.body);
    if (!m) continue;
    const [, matchFrom, matchTo, criteriaRef, sumCol, sumFrom] = m;
    const criteria = readCellNumber(xml, criteriaRef);
    let total = 0;
    if (criteria != null) {
      const span = Number(matchTo) - Number(matchFrom);
      for (let i = 0; i <= span; i++) {
        if (readCellNumber(checkbookXml, `E${Number(matchFrom) + i}`) === criteria) {
          total += readCellNumber(checkbookXml, `${sumCol}${Number(sumFrom) + i}`) ?? 0;
        }
      }
    }
    setValue(cell.ref, round2(total));
  }
  xml = patchFormulaCaches(xml, edits);
  edits.length = 0;

  // Section totals: SUM(D#:D#) — Total Income and Total Expenses, each
  // built from the D-column cells just computed above.
  for (const cell of formulaCells(xml)) {
    const m = /^SUM\(D(\d+):D(\d+)\)$/.exec(cell.body);
    if (!m) continue;
    const [, fromRow, toRow] = m;
    let total = 0;
    for (let row = Number(fromRow); row <= Number(toRow); row++) {
      total += values.get(`D${row}`) ?? readCellNumber(xml, `D${row}`) ?? 0;
    }
    setValue(cell.ref, round2(total));
  }
  xml = patchFormulaCaches(xml, edits);
  edits.length = 0;

  // Ending Balance: E53 = E7 + E27 - E51 (Starting + Income - Expenses).
  const ending = formulaCells(xml).find((c) => c.ref === "E53");
  const endingMatch = ending && /^([A-Z]+\d+)\+([A-Z]+\d+)-([A-Z]+\d+)$/.exec(ending.body);
  if (!endingMatch) {
    throw new Error(`IncStmt!E53 formula changed from the expected sum/difference shape: ${ending?.body}`);
  }
  const [, a, b, c] = endingMatch;
  const read = (ref: string) => values.get(ref) ?? readCellNumber(xml, ref) ?? 0;
  setValue("E53", round2(read(a) + read(b) - read(c)));

  return patchFormulaCaches(xml, edits);
}

export function recalcSummaryFormulas(xml: string, incStmtXml: string): string {
  const values = new Map<string, number>();
  const edits: FormulaCacheEdit[] = [];
  const setValue = (ref: string, value: number) => {
    values.set(ref, value);
    edits.push({ ref, value });
  };

  // C/E columns: VLOOKUP(<this row's code cell>, IncStmt!$B$..:$D$..,
  // 3, FALSE) — an exact-match lookup against IncStmt's now-correct D
  // column. A blank lookup cell (a few rows are label/spacer rows, not
  // real accounts — see the real sheet) has nothing to look up and is
  // left alone, matching Excel leaving that formula's own cell blank too
  // in the source workbook.
  const vlookupRe = /^VLOOKUP\(([A-Z]+\d+),IncStmt!\$B\$(\d+):\$D\$(\d+),3,FALSE\)$/;
  for (const cell of formulaCells(xml)) {
    const m = vlookupRe.exec(cell.body);
    if (!m) continue;
    const [, lookupRef, fromRow, toRow] = m;
    const key = readCellNumber(xml, lookupRef);
    if (key == null) continue;
    let found: number | null = null;
    for (let row = Number(fromRow); row <= Number(toRow); row++) {
      if (readCellNumber(incStmtXml, `B${row}`) === key) {
        found = readCellNumber(incStmtXml, `D${row}`) ?? 0;
        break;
      }
    }
    if (found === null) {
      // Every code Summary looks up is expected to exist in IncStmt's
      // own account table (same chart of accounts) — a miss means the
      // two sheets' account lists have drifted apart in the template.
      throw new Error(
        `Summary!${cell.ref}: VLOOKUP found no IncStmt row for code ${key} in $B$${fromRow}:$D$${toRow}.`
      );
    }
    setValue(cell.ref, round2(found));
  }
  xml = patchFormulaCaches(xml, edits);
  edits.length = 0;

  // G column: <income cell> - <expense cell>, one formula shared down a
  // fixed row range — read that range from the shared formula's own
  // ref="..." attribute instead of hardcoding it.
  const diffMaster = formulaCells(xml).find((c) => /^[A-Z]+\d+-[A-Z]+\d+$/.test(c.body));
  if (!diffMaster) {
    throw new Error("Summary: expected a C-E style difference formula (G column) but found none.");
  }
  const range = /ref="[A-Z]+(\d+):[A-Z]+(\d+)"/.exec(diffMaster.attrs);
  if (!range) {
    throw new Error(`Summary!${diffMaster.ref}: expected a shared-formula ref="..." range attribute.`);
  }
  const [, colA, colB] = /^([A-Z]+)\d+-([A-Z]+)\d+$/.exec(diffMaster.body)!;
  for (let row = Number(range[1]); row <= Number(range[2]); row++) {
    const a = values.get(`${colA}${row}`) ?? readCellNumber(xml, `${colA}${row}`) ?? 0;
    const b = values.get(`${colB}${row}`) ?? readCellNumber(xml, `${colB}${row}`) ?? 0;
    setValue(`G${row}`, round2(a - b));
  }
  xml = patchFormulaCaches(xml, edits);
  edits.length = 0;

  // Net total: SUM(G#:G#), built from the G-column cells just computed.
  const sumMaster = formulaCells(xml).find((c) => /^SUM\(G\d+:G\d+\)$/.test(c.body));
  if (!sumMaster) {
    throw new Error("Summary: expected a SUM(G#:G#) net total formula but found none.");
  }
  const [, fromRow, toRow] = /^SUM\(G(\d+):G(\d+)\)$/.exec(sumMaster.body)!;
  let total = 0;
  for (let row = Number(fromRow); row <= Number(toRow); row++) total += values.get(`G${row}`) ?? 0;
  setValue(sumMaster.ref, round2(total));

  return patchFormulaCaches(xml, edits);
}
