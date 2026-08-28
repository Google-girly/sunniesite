import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import type { Member, Meeting, OfficerReport } from "@/app/generated/prisma/client";
import { currentTerm } from "@/lib/communityService";
import { OFFICER_REPORT_TEMPLATE_LABELS } from "@/lib/meetingMinutes";
import { OFFICER_POSITIONS, type OfficerPosition } from "@/lib/positions";
import { findRoleHolderNames } from "@/lib/roster";
import { escapeXmlText, readEntry } from "@/lib/xlsxPatch";
import {
  fillEmptyParensAfter,
  fillTableCellsAfterHeader,
  insertParagraphsAfter,
  insertRunAfterLabel,
  replaceRunText,
} from "@/lib/docxPatch";

const TEMPLATE_PATH = path.join(process.cwd(), "lib/templates/meeting-minutes-template.docx");

// The Active Roster table has exactly 4 rows, each Name | Email — a
// real capacity limit of the physical template, same situation as every
// other fixed-size table/row-block this app fills in. Only the Name
// column is filled for now (stride=2 below skips the Email column);
// Member already has an email field, but the Email column stays blank
// until asked for.
export const ACTIVE_ROSTER_ROW_CAPACITY = 4;

// Every officer heading in "Minutes Template.docx" is its own paragraph
// (list level 1 of numId=1 — renders as "A. President ()", "B. Vice
// President ()", ...) split into (at least) two runs: a label run and a
// separate, differently-colored "()" placeholder run right after it —
// see lib/meetingMinutes.ts for the exact label text per position,
// which reads noticeably differently from lib/positions.ts
// OFFICER_POSITIONS in several spots ("VP of Communications," "Cultura &
// Sisterhood," no "Commissioner of" prefix on several positions).
const HEADING_ANCHORS: Record<OfficerPosition, string> = OFFICER_REPORT_TEMPLATE_LABELS;

// Builds one <w:p> for a submitted report — same list (numId=1) as the
// officer headings, one level deeper (ilvl=2, which this template's own
// numbering.xml defines as a plain decimal sub-list: "1.", "2.", ...),
// nesting it under whichever heading it's inserted after. Literal
// newlines become <w:br/> so a multi-line report still renders as line
// breaks within the one list item, not run together.
function buildReportParagraphXml(text: string): string {
  const lines = text.split("\n").map((line) => escapeXmlText(line));
  const runInner = lines.map((line) => `<w:t xml:space="preserve">${line}</w:t>`).join("<w:br/>");
  return (
    `<w:p><w:pPr><w:pageBreakBefore w:val="0"/><w:numPr><w:ilvl w:val="2"/><w:numId w:val="1"/></w:numPr>` +
    `<w:ind w:left="2160" w:hanging="360"/>` +
    `<w:rPr><w:rFonts w:ascii="Georgia" w:cs="Georgia" w:eastAsia="Georgia" w:hAnsi="Georgia"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Georgia" w:cs="Georgia" w:eastAsia="Georgia" w:hAnsi="Georgia"/></w:rPr>` +
    `${runInner}</w:r></w:p>`
  );
}

// Fills the real Minutes template's Date and Meeting Call to Order
// fields, plus every officer heading's current holder + submitted
// report. Everything else (Roll Call, Approval of Minutes/Agenda,
// Business, Old Business, Announcements, Adjournment) is left as the
// template's own blank fields, filled in by hand the same way the
// chapter already does today.
export async function buildMeetingMinutesDocx(
  meeting: Meeting,
  reports: OfficerReport[],
  members: Pick<Member, "name" | "role" | "status">[]
): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);
  let xml = await readEntry(zip, "word/document.xml");

  if (meeting.date) {
    const dateRun = `<w:r><w:rPr><w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">${escapeXmlText(
      formatDateForDoc(meeting.date)
    )}</w:t></w:r>`;
    xml = insertRunAfterLabel(xml, "Date: ", dateRun);
  }
  if (meeting.time) {
    const timeRun = `<w:r><w:rPr><w:rFonts w:ascii="Georgia" w:cs="Georgia" w:eastAsia="Georgia" w:hAnsi="Georgia"/><w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">${escapeXmlText(
      meeting.time
    )}</w:t></w:r>`;
    xml = insertRunAfterLabel(xml, "Meeting Call to Order: ", timeRun);
  }

  // Active Roster table — "Fall 2023" -> the term this meeting actually
  // falls in, and its (fixed, 4-row) capacity filled with current Active
  // members' names, alphabetically. Each row is Name | Email; stride=2
  // fills only the Name column for now and leaves Email blank.
  const term = currentTerm(parseIsoDateLocal(meeting.date));
  xml = replaceRunText(xml, "Active Roster Fall 2023", `Active Roster ${term}`);
  const activeNames = members
    .filter((m) => m.status === "ACTIVE")
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, ACTIVE_ROSTER_ROW_CAPACITY);
  xml = fillTableCellsAfterHeader(xml, `Active Roster ${term}`, activeNames, 2);

  const reportsByPosition = new Map(reports.map((r) => [r.position, r.report]));

  for (const position of OFFICER_POSITIONS) {
    const anchor = HEADING_ANCHORS[position];

    // Insert the report paragraph first, while the label run is still
    // followed by its original "()" — filling in the holder's name
    // (below) doesn't remove the "()" run itself (fillEmptyParensAfter
    // only rewrites its text content), so this ordering isn't as
    // load-bearing as it was for the other template, but keeping insert
    // before fill avoids re-deriving that guarantee here too.
    const report = reportsByPosition.get(position)?.trim();
    const paragraphXml = buildReportParagraphXml(report || "No report submitted.");
    xml = insertParagraphsAfter(xml, anchor, paragraphXml);

    const holders = findRoleHolderNames(members, position);
    if (holders) {
      xml = fillEmptyParensAfter(xml, anchor, holders);
    }
  }

  zip.file("word/document.xml", xml);

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

function formatDateForDoc(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${Number(month)}/${Number(day)}/${year}`;
}

// currentTerm() reads month/year off a plain JS Date via its *local*
// getMonth()/getFullYear() — constructing from the ISO string directly
// (`new Date("2026-09-01")`) parses as UTC midnight, which can land on
// the wrong local calendar day (and therefore the wrong term) depending
// on the server's timezone. Building the Date from the same YYYY/MM/DD
// components instead keeps it aligned with what the string actually says.
export function parseIsoDateLocal(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return new Date(iso);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function meetingMinutesFilename(meeting: Meeting): string {
  return `theta-chapter-meeting-minutes-${meeting.date}.docx`;
}
