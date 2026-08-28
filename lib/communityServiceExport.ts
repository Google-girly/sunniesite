import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import type { MakeUpProject, Member, ServiceHourEntry } from "@/app/generated/prisma/client";
import { calculateServiceTotals, categorizedEventText, currentTerm } from "@/lib/communityService";
import { parseRoles } from "@/lib/roster";
import {
  type CellEdit,
  patchCell,
  patchCells,
  readEntry,
  resolveSheetPath,
  forceFullCalcOnLoad,
} from "@/lib/xlsxPatch";
import { addClonedSheet, initialWorkbookState } from "@/lib/xlsxSheetClone";

type MemberWithHours = Member & { serviceHours: ServiceHourEntry[] };
type MemberWithMakeUp = Member & { makeUpProjects: MakeUpProject[] };

const HOURS_TEMPLATE_PATH = path.join(
  process.cwd(),
  "lib/templates/community-service-template.xlsx"
);
const REPORT_TEMPLATE_PATH = path.join(
  process.cwd(),
  "lib/templates/community-service-report-template.xlsx"
);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Unlike Budget Log/Checkbook (built with hundreds of pre-styled blank
// rows to spare), this real template — an older Google Sheets export —
// only actually has real, styled <c> cells through row 22, and even
// within that range it's not all usable log rows: 12-20 (9 rows) are
// the real per-entry rows, but 21-22 turn out to be a merged notes/
// signature block (B21:G21, B22:C22), not more table — writing into
// them lands inside a merge and gets silently swallowed by Excel, which
// only ever shows a merged range's top-left cell. Rows past 22 exist as
// empty placeholders with no cells at all. So logRowForIndex() below
// places the first 9 entries in 12-20, then jumps straight to 23+ for
// any more — skipping 21-22 forever — synthesizing real cells there via
// ensureLogRowCells() (copied from row 19's style pattern) so a long log
// still gets every entry instead of being silently truncated.
//
// One more real-template quirk, worth calling out because it's easy to
// reintroduce by accident: rows 13-20's own "Hours" column (E) already
// carries a *date* number format in the original file (probably a
// leftover from whatever this style was copied from) — Excel doesn't
// clear a cell's format just because a plain number gets typed into it,
// so writing 2.5 there renders as a garbled date, not "2.5". HOURS_STYLE
// below is E12's style instead (proven to render a plain number
// correctly) and gets force-applied to every Hours cell this code
// writes, overriding whatever style the row started with.
const HOURS_LOG_FIRST_ROW = 12;
const HOURS_LOG_LAST_USABLE_ROW = 20; // 21-22 are the merged notes block, not data rows
const HOURS_LOG_RESUME_ROW = 23; // where synthesized rows pick back up after skipping 21-22
const HOURS_LOG_LAST_STYLED_ROW = 22;
const HOURS_LOG_MAX_ROW = 200;
const HOURS_STYLE = "27";
const HOURS_LOG_ROW_STYLES: Record<string, string> = {
  A: "25",
  B: "34",
  C: "35",
  D: "31",
  E: HOURS_STYLE,
  F: "32",
  G: "28",
};

// The Nth (0-indexed) log entry's row: fills 12-20 first (9 rows), then
// resumes at 23+ — see the block comment above for why 21-22 are
// off-limits.
function logRowForIndex(i: number): number {
  const usableFirstBlock = HOURS_LOG_LAST_USABLE_ROW - HOURS_LOG_FIRST_ROW + 1;
  if (i < usableFirstBlock) return HOURS_LOG_FIRST_ROW + i;
  return HOURS_LOG_RESUME_ROW + (i - usableFirstBlock);
}

// Expands an empty, cell-less placeholder row (`<row r="N" .../>`, self-
// closing — everything past HOURS_LOG_LAST_STYLED_ROW starts out this
// way) into one with real, styled-but-blank cells for the log table's
// columns, so patchCell has something to write into. A no-op for rows
// that already have real cells (row <= HOURS_LOG_LAST_STYLED_ROW).
function ensureLogRowCells(xml: string, row: number): string {
  const selfClosing = new RegExp(`<row r="${row}"([^>]*)/>`);
  if (!selfClosing.test(xml)) return xml;
  return xml.replace(selfClosing, (_match, attrs: string) => {
    const cells = Object.entries(HOURS_LOG_ROW_STYLES)
      .map(([col, style]) => `<c r="${col}${row}" s="${style}"/>`)
      .join("");
    return `<row r="${row}"${attrs}>${cells}</row>`;
  });
}

// Forces a cell's style attribute to `styleId`, overriding whatever the
// template shipped with — see the Hours-column date-format quirk above.
// Only rewrites the `s="..."` attribute; leaves the value alone.
function forceCellStyle(xml: string, ref: string, styleId: string): string {
  const cellRe = new RegExp(`(<c r="${ref}")( s="\\d+")?`);
  if (!cellRe.test(xml)) return xml;
  return xml.replace(cellRe, `$1 s="${styleId}"`);
}

// Builds one workbook with the real "Community Service Hours" template's
// EXAMPLE sheet cloned once per Active/Inactive roster member — same
// header layout (Chapter/Term/Name and Line Number/Position/Personal
// Email) and log table (Date/Event/Description/Hours), filled from each
// member's ServiceHourEntry rows. The original EXAMPLE sheet stays as
// the first tab, unfilled, for reference — matches how the chapter's own
// past version of this workbook keeps it around too.
//
// Column mapping for the log table (read off the template's own row
// 10-11 header: B=Date, C=Event, D=Description, E=Hours, F/G="Volunteer
// Contact Information" split into "Total Hours"/"Supervisors Info."):
// volunteer contact goes in G ("Supervisors Info."); column A ("Scroll
// Number") and F ("Total Hours" per-row) are left alone — their exact
// intended use wasn't clear from the template alone.
export async function buildCommunityServiceWorkbook(
  members: MemberWithHours[]
): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(HOURS_TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);
  const exampleSheetPath = await resolveSheetPath(zip, "EXAMPLE");
  const exampleXml = await readEntry(zip, exampleSheetPath);

  const state = initialWorkbookState(["EXAMPLE"], 2, 2);
  const term = currentTerm();

  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));

  for (const member of sorted) {
    let sheetXml = exampleXml;

    const position = parseRoles(member.role).join(", ");
    const nameAndLine =
      `Name and Line Number : ${member.name}` +
      (member.crossingNumber != null ? `; ${member.crossingNumber}` : "");

    sheetXml = patchCells(sheetXml, [
      { ref: "C6", value: `Term:  ${term}` },
      { ref: "B7", value: nameAndLine },
      { ref: "D7", value: `Position: ${position}` },
      { ref: "B8", value: "Phone: " },
      { ref: "D8", value: `Personal Email: ${member.email ?? ""}` },
    ]);

    const entries = [...member.serviceHours].sort((a, b) => a.date.localeCompare(b.date));
    entries.forEach((entry, i) => {
      const row = logRowForIndex(i);
      if (row > HOURS_LOG_MAX_ROW) return;
      if (row > HOURS_LOG_LAST_STYLED_ROW) {
        sheetXml = ensureLogRowCells(sheetXml, row);
      }
      sheetXml = forceCellStyle(sheetXml, `E${row}`, HOURS_STYLE);
      const eventText = categorizedEventText(entry);
      sheetXml = patchCells(sheetXml, [
        { ref: `B${row}`, value: entry.date },
        { ref: `C${row}`, value: eventText },
        { ref: `D${row}`, value: entry.description },
        { ref: `E${row}`, value: round2(entry.hours) },
        { ref: `G${row}`, value: entry.volunteerContact },
      ]);
    });

    await addClonedSheet(zip, state, member.name, sheetXml);
  }

  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  zip.file("xl/workbook.xml", forceFullCalcOnLoad(workbookXml));

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function communityServiceExportFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `community-service-hours-${today}.xlsx`;
}

// --- Compiled report (Chapter Standard Forms Section C3/C4 & C6) -------

const REPORT_BLOCK_ROWS = 5; // one member's block, name row through last data row
const C3C4_FIRST_NAME_ROW = 16;
const C3C4_DATA_ROWS = 3;
const C6_FIRST_NAME_ROW = 15;
const C6_DATA_ROWS = 3;
const REPORT_MAX_ROW = 1000; // matches both sheets' pre-styled extent (~1026/1027)

// Fills the official "Community Service Chapter Standard Forms" —
// Section C3 & C4 (one Name/Date/Event/Description/Hours/Total block per
// member, repeated every 5 rows) and Section C6 (Community Service
// Make-Up: one Name/Term Hours Uncompleted/Make Up Project/Due
// Date/Completed?/Library Hours Completed? block per member on make-up
// status). Both sections only have 3 data rows per member's block — a
// real limitation of the official form itself, not something this
// invents rows around — so a member with more than 3 logged events (or
// more than 3 make-up projects on file) only shows her first 3,
// chronologically. Section C3/C4 covers every Active/Inactive member;
// Section C6 only covers members who actually have a MakeUpProject row.
export async function buildCommunityServiceReportWorkbook(
  hoursMembers: MemberWithHours[],
  makeUpMembers: MemberWithMakeUp[]
): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(REPORT_TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);
  const term = currentTerm();

  // Section C3 & C4
  const c3c4Path = await resolveSheetPath(zip, "Section C3 & C4");
  let c3c4Xml = await readEntry(zip, c3c4Path);
  c3c4Xml = patchCell(c3c4Xml, "A10", "Chapter: Theta");
  c3c4Xml = patchCell(c3c4Xml, "C10", `Term: ${term}`);

  const sortedHoursMembers = [...hoursMembers].sort((a, b) => a.name.localeCompare(b.name));
  sortedHoursMembers.forEach((member, i) => {
    const nameRow = C3C4_FIRST_NAME_ROW + i * REPORT_BLOCK_ROWS;
    if (nameRow > REPORT_MAX_ROW) return;

    const edits: CellEdit[] = [{ ref: `A${nameRow}`, value: `Name: ${member.name}` }];
    const totals = calculateServiceTotals(member.serviceHours);
    const entries = [...member.serviceHours].sort((a, b) => a.date.localeCompare(b.date));
    entries.slice(0, C3C4_DATA_ROWS).forEach((entry, j) => {
      const row = nameRow + 2 + j;
      edits.push({ ref: `B${row}`, value: entry.date });
      edits.push({ ref: `C${row}`, value: categorizedEventText(entry) });
      edits.push({ ref: `D${row}`, value: entry.description });
      edits.push({ ref: `E${row}`, value: round2(entry.hours) });
    });
    edits.push({ ref: `F${nameRow + 2}`, value: round2(totals.total) });

    c3c4Xml = patchCells(c3c4Xml, edits);
  });
  zip.file(c3c4Path, c3c4Xml);

  // Section C6 — Community Service Make-Up
  const c6Path = await resolveSheetPath(zip, "Section C6");
  let c6Xml = await readEntry(zip, c6Path);
  c6Xml = patchCell(c6Xml, "A10", "Chapter: Theta");
  c6Xml = patchCell(c6Xml, "C10", `Term: ${term}`);

  const sortedMakeUpMembers = [...makeUpMembers]
    .filter((m) => m.makeUpProjects.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  sortedMakeUpMembers.forEach((member, i) => {
    const nameRow = C6_FIRST_NAME_ROW + i * REPORT_BLOCK_ROWS;
    if (nameRow > REPORT_MAX_ROW) return;

    const edits: CellEdit[] = [{ ref: `A${nameRow}`, value: `Name: ${member.name}` }];
    const projects = [...member.makeUpProjects].sort((a, b) => a.term.localeCompare(b.term));
    projects.slice(0, C6_DATA_ROWS).forEach((project, j) => {
      const row = nameRow + 2 + j;
      edits.push({ ref: `B${row}`, value: round2(project.hoursUncompleted) });
      edits.push({ ref: `C${row}`, value: project.project });
      edits.push({ ref: `D${row}`, value: project.dueDate });
      edits.push({ ref: `E${row}`, value: project.completed ? "Yes" : "No" });
      edits.push({ ref: `F${row}`, value: project.libraryHoursCompleted ? "Yes" : "No" });
    });

    c6Xml = patchCells(c6Xml, edits);
  });
  zip.file(c6Path, c6Xml);

  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  zip.file("xl/workbook.xml", forceFullCalcOnLoad(workbookXml));

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function communityServiceReportExportFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `community-service-report-${today}.xlsx`;
}
