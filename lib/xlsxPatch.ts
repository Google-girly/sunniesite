import JSZip from "jszip";

// Shared "surgical XML edit" helpers for filling in real .xlsx templates —
// used by both lib/budgetExport.ts and lib/financialBooksExport.ts. See
// the comment at the top of budgetExport.ts for why this approach (find
// each target cell's existing <c> element and replace only its value)
// beats loading the whole workbook through a library that reparses and
// rewrites it: round-tripping through one of those (we tried ExcelJS)
// silently renumbered the style table on every save, which broke borders
// on merged boxes elsewhere in the file. This never touches anything
// except the specific cells listed.

export type CellEdit = { ref: string; value: string | number | null };

export async function readEntry(zip: JSZip, entryPath: string): Promise<string> {
  const file = zip.file(entryPath);
  if (!file) throw new Error(`Template is missing expected part "${entryPath}".`);
  return file.async("string");
}

export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Replaces one <c r="REF" .../> element's value in place — keeps that
// cell's existing style (s="N") and every other attribute, drops any
// existing type attribute (t="..."), and writes the new value as a
// number or as inline text (t="inlineStr"), which never requires
// touching sharedStrings.xml. Throws if the template doesn't have that
// cell, since a silent no-op there would mean data quietly went missing.
export function patchCell(xml: string, ref: string, value: string | number | null): string {
  const cellRe = new RegExp(`<c r="${ref}"((?:\\s+[\\w:.-]+="[^"]*")*)\\s*(?:/>|>([\\s\\S]*?)</c>)`);
  const match = cellRe.exec(xml);
  if (!match) {
    throw new Error(`Template is missing expected cell ${ref}.`);
  }

  const attrs = (match[1] ?? "").replace(/\s+t="[^"]*"/, "");

  let replacement: string;
  if (value === null || value === "") {
    replacement = `<c r="${ref}"${attrs}/>`;
  } else if (typeof value === "number") {
    replacement = `<c r="${ref}"${attrs}><v>${value}</v></c>`;
  } else {
    replacement = `<c r="${ref}"${attrs} t="inlineStr"><is><t xml:space="preserve">${escapeXmlText(
      value
    )}</t></is></c>`;
  }

  return xml.slice(0, match.index) + replacement + xml.slice(match.index + match[0].length);
}

export function patchCells(xml: string, edits: CellEdit[]): string {
  return edits.reduce((acc, { ref, value }) => patchCell(acc, ref, value), xml);
}

export type FormulaCacheEdit = { ref: string; value: number | "" };

// Updates a formula cell's *cached* <v> result in place, leaving its <f>
// formula untouched — unlike patchCell, which would delete the formula
// entirely. Excel is supposed to recalculate every formula on open
// because forceFullCalcOnLoad() below sets fullCalcOnLoad="1", but that
// isn't reliable in practice (e.g. a browser-downloaded file opened in
// Windows Excel's Protected View, or an app-wide manual-calculation
// setting some users have) — when the recalc doesn't happen, whatever
// stale value the template shipped with (usually 0, since the template
// itself has no data) is what's shown instead. Baking the real answer in
// here means the workbook displays correctly the instant it's opened,
// with or without a recalc; if Excel *does* recalculate, it'll compute
// the same number from the same formula and cells anyway.
//
// `value: ""` covers a formula whose result is the empty string (e.g.
// Final Budget's per-row tax formula, IF(taxable, ..., "")) — Excel
// caches that as a t="str" cell with an empty <v>, not a numeric one.
export function patchFormulaCache(xml: string, ref: string, value: number | ""): string {
  // The <f> tag's own attrs must use the same "\s+name="value"" repeated
  // pattern as the <c> tag's, not a blanket [^>]*: a blanket match also
  // swallows the trailing "/" of a self-closing shared-formula cell like
  // <f t="shared" si="0"/> (every row after the first in a shared-formula
  // block, e.g. Total $ Spent rows 8-43), which then forces the /> vs
  // >...</f> alternation down the wrong branch and sends [\s\S]*? hunting
  // for the next </f> anywhere later in the sheet — silently overwriting
  // everything up to and including some unrelated cell.
  const cellRe = new RegExp(
    `<c r="${ref}"((?:\\s+[\\w:.-]+="[^"]*")*)>(<f\\b(?:\\s+[\\w:.-]+="[^"]*")*(?:/>|>[\\s\\S]*?</f>))(?:<v(?:\\s[^>]*)?(?:/>|>[\\s\\S]*?</v>))?</c>`
  );
  const match = cellRe.exec(xml);
  if (!match) {
    throw new Error(`Template is missing expected formula cell ${ref}.`);
  }

  const attrs = match[1].replace(/\s+t="[^"]*"/, "");
  const fElement = match[2];
  const typeAttr = value === "" ? ' t="str"' : "";
  const vElement = value === "" ? "<v></v>" : `<v>${value}</v>`;
  const replacement = `<c r="${ref}"${attrs}${typeAttr}>${fElement}${vElement}</c>`;

  return xml.slice(0, match.index) + replacement + xml.slice(match.index + match[0].length);
}

export function patchFormulaCaches(xml: string, edits: FormulaCacheEdit[]): string {
  return edits.reduce((acc, { ref, value }) => patchFormulaCache(acc, ref, value), xml);
}

// True if cell REF currently holds a real value (a <v>...</v> or an
// inline/shared string with content) — used to find the first "blank"
// row in a table that already has some rows filled in by hand, so an
// export appends after whatever's really there instead of assuming a
// fixed row number.
export function cellHasValue(xml: string, ref: string): boolean {
  // Same attribute pattern as patchCell — a loose `[^>]*` here would
  // happily consume a self-closing cell's trailing "/" and then keep
  // scanning for the *next* real "</c>" anywhere later in the row,
  // which can span past several other self-closing cells and produce a
  // false positive.
  const cellRe = new RegExp(`<c r="${ref}"(?:\\s+[\\w:.-]+="[^"]*")*\\s*(?:/>|>([\\s\\S]*?)</c>)`);
  const match = cellRe.exec(xml);
  if (!match) return false;
  const inner = match[1];
  return !!inner && /<v>|<is>|<t[ >]/.test(inner);
}

// Resolves a sheet's display name (e.g. "Final Budget") to its part path
// (e.g. "xl/worksheets/sheet3.xml") by reading the workbook's own
// name -> relationship-id -> target mapping, rather than hardcoding a
// filename that could shift if the template is ever re-saved by Excel.
export async function resolveSheetPath(zip: JSZip, sheetName: string): Promise<string> {
  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  // Sheet names land in an XML attribute, so a name containing "&" (e.g.
  // "Section C3 & C4") is stored as "...C3 &amp; C4" — escape XML special
  // characters first, then regex-escape what's left, or a name like that
  // never matches.
  const escapedName = escapeXmlText(sheetName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagMatch = new RegExp(`<sheet\\b[^>]*name="${escapedName}"[^>]*/>`).exec(workbookXml);
  if (!tagMatch) throw new Error(`Template is missing a "${sheetName}" sheet.`);
  const relId = /r:id="(rId\d+)"/.exec(tagMatch[0])?.[1];
  if (!relId) throw new Error(`Template's "${sheetName}" sheet has no relationship id.`);

  const relsXml = await readEntry(zip, "xl/_rels/workbook.xml.rels");
  const relMatch = new RegExp(`<Relationship\\b[^>]*Id="${relId}"[^>]*/>`).exec(relsXml);
  const target = relMatch && /Target="([^"]+)"/.exec(relMatch[0])?.[1];
  if (!target) {
    throw new Error(`Template's workbook.xml.rels is missing target for ${relId}.`);
  }
  return `xl/${target}`;
}

// Converts an ISO "YYYY-MM-DD" string to the numeric value Excel expects
// in a date-formatted cell. Excel's date epoch is "day 0" = Dec 30, 1899
// (the well-known constant that also absorbs the program's famous fake
// Feb 29, 1900 — no extra correction needed for any date after that).
// Writing a plain string into a date cell instead of this — even one
// that displays fine on its own — breaks any formula elsewhere in the
// sheet that does date arithmetic on it (Excel can't subtract text).
export function isoDateToExcelSerial(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

// Excel caches formula results and won't recompute them until told to —
// this forces a recalc on open so any formulas that read cells we just
// wrote (e.g. Budget/Total Spent, or Summary's VLOOKUPs) reflect the new
// values immediately, without touching anything else in workbook.xml.
export function forceFullCalcOnLoad(workbookXml: string): string {
  if (!/<calcPr\b/.test(workbookXml)) return workbookXml;
  if (/<calcPr\b[^/]*fullCalcOnLoad=/.test(workbookXml)) return workbookXml;
  return workbookXml.replace(/<calcPr\b([^/]*)\/>/, (_m, attrs) => `<calcPr${attrs} fullCalcOnLoad="1"/>`);
}
