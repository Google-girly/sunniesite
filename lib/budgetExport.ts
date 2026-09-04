import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import type { Budget, BudgetLineItem, BudgetVersion } from "@/app/generated/prisma/client";
import { calculateBudgetTotals, lineItemTotal, type BudgetStage } from "@/lib/budgets";
import {
  type CellEdit,
  type FormulaCacheEdit,
  patchCells,
  patchFormulaCaches,
  readEntry,
  resolveSheetPath,
  forceFullCalcOnLoad,
} from "@/lib/xlsxPatch";

type VersionWithItems = BudgetVersion & { lineItems: BudgetLineItem[] };

const TEMPLATE_PATH = path.join(process.cwd(), "lib/templates/son-expense-budget-template.xlsx");

// Max item rows the real template has room for on either sheet (rows
// 7-43) before the Notes / totals / NVP Finance box starts at row 44.
const MAX_LINE_ITEMS = 37;

// This fills in the chapter's actual template (Templates/Copy of SON
// Expense Budget.xlsx) — not a lookalike rebuild. It works by editing
// the workbook's XML directly: find each target cell's existing <c>
// element and replace only its value, keeping that cell's style
// attribute and touching nothing else in the file byte-for-byte (an
// earlier version round-tripped the whole workbook through a library
// that rebuilt the style table on every write, which subtly broke
// borders on the merged boxes — this avoids that class of bug entirely
// by never asking anything to "understand" the file, just edit it).
//
// The exact cell map below was read out of the real file directly (see
// the row/merge dump in project notes), not guessed from the labels.
// Both sheets share the same header layout (Budget #/Event/Chair/Date
// all one column over from their label). They differ after that:
// Tentative has one manual "Tax:" dollar amount and no per-item Taxable
// column; Final computes tax per line item via a formula that reads the
// sales tax rate from INSTRUCTIONS!G6, which is why we write the rate
// there for Final exports. Formula cells (Subtotal, Total, Total Spent,
// and — on Final — Tax) keep their formulas, but their cached results are
// also computed here and written in, rather than trusted to Excel's
// on-open recalc — see patchFormulaCache() in lib/xlsxPatch.ts for why.
//
// One more fix beyond cell values: see forcePageFitToOnePage() below —
// the template's own page setup has a stale embedded printer reference
// that can make real Excel paginate one page of content across a 2x2
// grid of print pages, so that gets stripped on export too.
export async function buildBudgetWorkbook(
  budget: Budget,
  version: VersionWithItems
): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const stage: BudgetStage = version.stage === "FINAL" ? "FINAL" : "TENTATIVE";
  await applyStageEdits(zip, budget, version, stage);

  // The exported workbook still carries the *other* stage's sheet tab
  // (blank, since this budget isn't at that stage) — it has the same
  // stale printer reference, so fix its pagination too even though we
  // aren't writing any values into it.
  const otherSheetName = stage === "FINAL" ? "Tentative Budget" : "Final Budget";
  const otherSheetPath = await resolveSheetPath(zip, otherSheetName);
  const otherSheetXml = await readEntry(zip, otherSheetPath);
  zip.file(otherSheetPath, forcePageFitToOnePage(otherSheetXml));

  return finalizeWorkbook(zip);
}

// The "export whole budget" version — one file with both the Tentative
// and Final sheets filled in (whichever versions actually exist; a
// version that doesn't exist yet just leaves its sheet blank, same as
// the template ships). Same underlying edit logic as buildBudgetWorkbook,
// just applied to up to two sheets in one pass instead of one.
export async function buildFullBudgetWorkbook(
  budget: Budget,
  versions: { tentative?: VersionWithItems; final?: VersionWithItems }
): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  for (const [stage, version] of [
    ["TENTATIVE", versions.tentative],
    ["FINAL", versions.final],
  ] as const) {
    if (version) {
      await applyStageEdits(zip, budget, version, stage);
    } else {
      // No data to write, but still fix pagination on the blank sheet.
      const sheetName = stage === "FINAL" ? "Final Budget" : "Tentative Budget";
      const sheetPath = await resolveSheetPath(zip, sheetName);
      const sheetXml = await readEntry(zip, sheetPath);
      zip.file(sheetPath, forcePageFitToOnePage(sheetXml));
    }
  }

  return finalizeWorkbook(zip);
}

// Writes one stage's data into its sheet: header box, line items, notes,
// NVP Finance section, and (Final only) the sales tax rate on
// INSTRUCTIONS!G6. See the module-level comment above for the cell map
// and why this edits XML directly instead of going through a library.
async function applyStageEdits(
  zip: JSZip,
  budget: Budget,
  version: VersionWithItems,
  stage: BudgetStage
): Promise<void> {
  const sheetName = stage === "FINAL" ? "Final Budget" : "Tentative Budget";
  const sheetPath = await resolveSheetPath(zip, sheetName);

  const edits: CellEdit[] = [
    // Header box: same cell addresses on both sheets. Event/Chair/Date/
    // Budget# live on the parent Budget, shared by both versions.
    { ref: "F1", value: budget.budgetNumber },
    { ref: "F3", value: budget.eventName },
    { ref: "F4", value: budget.chair },
    { ref: "F5", value: budget.eventDate },
    // Notes box (A44, merged A44:E49 on both sheets).
    { ref: "A44", value: version.notes },
    // NVP Finance / Comptroller Use Only box (rows 51-55).
    { ref: "B51", value: version.motion },
    { ref: "B53", value: version.second },
    { ref: "E53", value: version.dateDue },
    { ref: "B55", value: version.vote },
    { ref: "E55", value: version.dateReceived },
  ];

  // Line items (rows 7-43). Each row's A:C is one merged "Item" cell;
  // only the top-left (A) needs a value. G (Tentative) / H (Final) are
  // formulas, so they're left as formulas — but their *cached* result
  // is also computed and written below (see formulaEdits) rather than
  // trusted to Excel's on-open recalc, which not every Excel build
  // honors (see patchFormulaCache's comment in lib/xlsxPatch.ts).
  const items = version.lineItems.slice(0, MAX_LINE_ITEMS);
  const totals = calculateBudgetTotals(items, version.salesTaxRate);
  const formulaEdits: FormulaCacheEdit[] = [];
  items.forEach((item, i) => {
    const row = 7 + i;
    edits.push({ ref: `A${row}`, value: item.item });
    edits.push({ ref: `D${row}`, value: item.quantity });
    edits.push({ ref: `E${row}`, value: item.price });
    if (stage === "TENTATIVE") {
      // "Total $ Spent" per line: D*E.
      formulaEdits.push({ ref: `G${row}`, value: round2(lineItemTotal(item)) });
    } else {
      edits.push({ ref: `F${row}`, value: item.taxable ? "Yes" : "No" });
      // "Total $ Spent" per line: D*E.
      formulaEdits.push({ ref: `H${row}`, value: round2(lineItemTotal(item)) });
      // Per-line tax: IF(taxable, D*E*rate, "").
      formulaEdits.push({
        ref: `G${row}`,
        value: item.taxable ? round2(lineItemTotal(item) * version.salesTaxRate) : "",
      });
    }
  });

  if (stage === "TENTATIVE") {
    // Tentative has no per-item tax formula — Tax is a manual dollar
    // figure the chair fills in by hand, so we compute it the same way
    // the app does everywhere else (lib/budgets.ts) and write the number.
    // (G48's "Income" cell is deliberately left alone — the app doesn't
    // track that anymore, see lib/budgets.ts.)
    edits.push({ ref: "G46", value: round2(totals.tax) });
    edits.push({ ref: "G53", value: version.checkNumber });
    edits.push({ ref: "G55", value: version.checkAmount });
    formulaEdits.push({ ref: "G45", value: round2(totals.subtotal) }); // Subtotal
    formulaEdits.push({ ref: "G47", value: round2(totals.total) }); // Total
  } else {
    edits.push({ ref: "H53", value: version.checkNumber });
    edits.push({ ref: "H55", value: version.checkAmount });
    formulaEdits.push({ ref: "H45", value: round2(totals.subtotal) }); // Subtotal
    formulaEdits.push({ ref: "H46", value: round2(totals.tax) }); // Tax
    formulaEdits.push({ ref: "H47", value: round2(totals.total) }); // Total

    // Final computes each line's tax via a formula that reads the sales
    // tax rate from INSTRUCTIONS!G6, so that's where the rate goes.
    const instructionsPath = await resolveSheetPath(zip, "INSTRUCTIONS");
    const instructionsXml = await readEntry(zip, instructionsPath);
    zip.file(
      instructionsPath,
      patchCells(instructionsXml, [{ ref: "G6", value: version.salesTaxRate }])
    );
  }

  let sheetXml = await readEntry(zip, sheetPath);
  sheetXml = patchCells(sheetXml, edits);
  sheetXml = patchFormulaCaches(sheetXml, formulaEdits);
  sheetXml = forcePageFitToOnePage(sheetXml);
  zip.file(sheetPath, sheetXml);
}

// Excel caches formula results and won't recompute them until told to —
// force a recalc on open so Subtotal/Tax/Total Spent reflect what was
// just written immediately, without touching anything else in
// workbook.xml. Shared tail end of both build*Workbook() functions.
async function finalizeWorkbook(zip: JSZip): Promise<Uint8Array> {
  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  zip.file("xl/workbook.xml", forceFullCalcOnLoad(workbookXml));

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function budgetExportFilename(budget: Budget, version: BudgetVersion): string {
  const stage = version.stage === "FINAL" ? "final" : "tentative";
  return `${budgetSlug(budget)}-${stage}-budget.xlsx`;
}

export function fullBudgetExportFilename(budget: Budget): string {
  return `${budgetSlug(budget)}-budget.xlsx`;
}

function budgetSlug(budget: Budget): string {
  return (
    budget.eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "budget"
  );
}

// --- XML surgery helpers ------------------------------------------------
// (patchCell/patchCells/readEntry/resolveSheetPath/forceFullCalcOnLoad now
// live in lib/xlsxPatch.ts, shared with lib/financialBooksExport.ts.)

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Both sheets are already marked <sheetPr><pageSetUpPr fitToPage="1"/>,
// meaning "shrink to fit" is meant to be on — but <pageSetup> also
// carries an r:id pointing at an embedded xl/printerSettings/*.bin (a
// printer/paper-size snapshot from whichever machine last saved the
// template in Excel). When that printer isn't available on whoever's
// machine opens the file next, Excel's fit-to-page math can quietly
// break and print/paginate the sheet across several pages instead of
// one — which is exactly what one page split into a 2x2 grid of print
// pages looks like. Dropping the printer reference makes Excel compute
// fit-to-page against its own default/virtual printer instead, and
// spelling out fitToWidth/fitToHeight makes "fit to exactly one page"
// explicit rather than relying on that being the unstated default.
function forcePageFitToOnePage(sheetXml: string): string {
  return sheetXml.replace(/<pageSetup\b([^>]*)\/>/, (match, attrs: string) => {
    const withoutPrinterRef = attrs.replace(/\s+r:id="rId\d+"/, "");
    const withFit = /fitToWidth=/.test(withoutPrinterRef)
      ? withoutPrinterRef
      : `${withoutPrinterRef} fitToWidth="1" fitToHeight="1"`;
    return `<pageSetup${withFit}/>`;
  });
}
