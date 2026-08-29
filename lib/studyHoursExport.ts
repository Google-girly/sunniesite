import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import type { Member, StudyHourEntry } from "@/app/generated/prisma/client";
import { calculateWeeklyCompletion, currentTermLabel } from "@/lib/studyHours";
import {
  isoDateToExcelSerial,
  patchCell,
  patchCells,
  readEntry,
  resolveSheetPath,
  forceFullCalcOnLoad,
} from "@/lib/xlsxPatch";
import { addClonedSheet, initialWorkbookState, removeSheet } from "@/lib/xlsxSheetClone";

type MemberWithStudyHours = Member & { studyHours: StudyHourEntry[] };

const TEMPLATE_PATH = path.join(process.cwd(), "lib/templates/study-hours-template.xlsx");
const STANDARDS_TEMPLATE_PATH = path.join(
  process.cwd(),
  "lib/templates/standards-forms-template.xlsx"
);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hhmmToExcelFraction(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return (hours * 60 + minutes) / 1440;
}

// The real template only has 22 pre-styled, pre-formatted data rows
// across its Jan-May month blocks (10-13, 15-20, 22-28, 30-32, 34-35 —
// row 36 exists but is excluded from the sheet's own SUM formula, and
// rows 9/14/21/29/33 are the merged month-header rows, not data). That
// works out to roughly one entry per week of a spring term, which
// matches how the Chapter Standards requirement is actually logged (one
// weekly study session, not one row per micro-session) — see
// lib/studyHours.ts. The month header text itself is left alone rather
// than rewritten to match real dates: it's cosmetic, and every row still
// carries its own real date in column B regardless of which header
// happens to sit above it.
const DATA_ROWS = [
  10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 30, 31, 32, 34, 35,
];

// Builds one workbook with the real "Library Study Hours" template's
// sheet cloned once per Active/Inactive roster member, filled from her
// StudyHourEntry rows. A member whose log exceeds the template's 22-row
// capacity for the term spills into a "(cont.)" sheet right after hers,
// using the identical layout, rather than silently dropping entries.
export async function buildStudyHoursWorkbook(
  members: MemberWithStudyHours[],
  term: string = currentTermLabel()
): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);
  const sheetPath = await resolveSheetPath(zip, "Library Hours");
  const baseXml = await readEntry(zip, sheetPath);

  const state = initialWorkbookState(["Library Hours"], 2, 2);
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));

  for (const member of sorted) {
    const entries = [...member.studyHours].sort((a, b) => a.date.localeCompare(b.date));
    const chunks: StudyHourEntry[][] = [];
    for (let i = 0; i < Math.max(entries.length, 1); i += DATA_ROWS.length) {
      chunks.push(entries.slice(i, i + DATA_ROWS.length));
    }

    for (let c = 0; c < chunks.length; c++) {
      let sheetXml = baseXml;
      // Aug 2026 — "for the study hours ... can you add [phone numbers]
      // to the sheet." The real template has no dedicated Phone cell, so
      // it rides along on the same "Name: ..." line rather than
      // fabricating a new cell the template's own layout doesn't have
      // room/styling for.
      sheetXml = patchCells(sheetXml, [
        { ref: "A6", value: "Chapter: Theta" },
        { ref: "B6", value: `Term: ${term}` },
        {
          ref: "A7",
          value: `Name: ${member.name}${member.phone ? `   Phone: ${member.phone}` : ""}`,
        },
      ]);

      chunks[c].forEach((entry, i) => {
        const row = DATA_ROWS[i];
        const edits = [
          { ref: `A${row}`, value: entry.location },
          { ref: `B${row}`, value: isoDateToExcelSerial(entry.date) },
          { ref: `E${row}`, value: round2(entry.hours) },
        ];
        if (entry.timeIn) {
          const frac = hhmmToExcelFraction(entry.timeIn);
          if (frac != null) edits.push({ ref: `C${row}`, value: frac });
        }
        if (entry.timeOut) {
          const frac = hhmmToExcelFraction(entry.timeOut);
          if (frac != null) edits.push({ ref: `D${row}`, value: frac });
        }
        sheetXml = patchCells(sheetXml, edits);
      });

      const sheetName = c === 0 ? member.name : `${member.name} (cont.)`;
      await addClonedSheet(zip, state, sheetName, sheetXml);
    }
  }

  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  zip.file("xl/workbook.xml", forceFullCalcOnLoad(workbookXml));

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function studyHoursExportFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `study-hours-${today}.xlsx`;
}

// --- Chapter Standards Section B4 (Active) / B6 (Inactive) report ------

const REPORT_TABLE_ROWS = 21; // see lib/standardsFormsExport.ts TABLE_ROWS — same template family

async function fillWeeklyCompletionSheet(
  zip: JSZip,
  sheetName: string,
  members: MemberWithStudyHours[],
  term: string,
  termStart: string,
  termEnd: string,
  countLabelRef: string
): Promise<void> {
  const sheetPath = await resolveSheetPath(zip, sheetName);
  let xml = await readEntry(zip, sheetPath);
  xml = patchCells(xml, [
    { ref: "A10", value: "Chapter: Theta" },
    { ref: "C10", value: `Term: ${term}` },
  ]);

  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
  sorted.slice(0, REPORT_TABLE_ROWS).forEach((member, i) => {
    const row = 16 + i;
    const completion = calculateWeeklyCompletion(member.studyHours, termStart, termEnd);
    xml = patchCells(xml, [
      { ref: `A${row}`, value: member.crossingNumber ?? i + 1 },
      { ref: `B${row}`, value: member.name },
      { ref: `C${row}`, value: completion.weeksInTerm },
      { ref: `D${row}`, value: completion.weeksCompleted },
      { ref: `E${row}`, value: `${completion.percentage}%` },
    ]);
  });
  xml = patchCell(xml, countLabelRef, sorted.length);

  zip.file(sheetPath, xml);
}

// Fills the real "Chapter Standard Forms" template's Section B4 (Active
// members) and Section B6 (Inactive members) with each member's weekly
// study-hour completion for the given term — see
// lib/standardsFormsExport.ts for why this shares that template rather
// than inventing its own file (same 21-row table layout as every other
// Chapter Standards roster section).
export async function buildStudyHoursReportWorkbook(
  activeMembers: MemberWithStudyHours[],
  inactiveMembers: MemberWithStudyHours[],
  term: string,
  termStart: string,
  termEnd: string
): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(STANDARDS_TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  await fillWeeklyCompletionSheet(zip, "Section B4", activeMembers, term, termStart, termEnd, "C37");
  await fillWeeklyCompletionSheet(zip, "Section B6", inactiveMembers, term, termStart, termEnd, "C37");

  // This export only wants B4/B6 out of the shared 12-sheet template.
  for (const name of [
    "Section B1",
    "Section B2",
    "Section B3",
    "Section B5",
    "Section C3 & C4",
    "Section C6",
    "Section D4",
    "Section D9",
    "Section D10",
    "Section D11",
  ]) {
    await removeSheet(zip, name);
  }

  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  zip.file("xl/workbook.xml", forceFullCalcOnLoad(workbookXml));

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function studyHoursReportExportFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `study-hours-report-${today}.xlsx`;
}
