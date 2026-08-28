import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import type { Member, Meeting, MeetingNote, OfficerReport } from "@/app/generated/prisma/client";
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
// other fixed-size table/row-block this app fills in. Only the first 4
// Active members (alphabetically) get a row; anyone past that isn't
// listed here, same as any other fixed-size template block in this app.
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
  return buildListParagraphXml(text, 2);
}

// Same shape as buildReportParagraphXml, generalized to any list level
// — used for both officer sub-reports (ilvl=2, under an ilvl=1 position
// heading) and Meeting Note entries (ilvl=1, under an ilvl=0 heading
// like "Old Business"; ilvl=2 under "Action Items", which is itself
// ilvl=1 — see buildMeetingMinutesDocx below). This template's own
// indent per level, read straight from its XML: ilvl 0 -> 720 twips,
// 1 -> 1440, 2 -> 2160 (720 * (ilvl+1), always w:hanging="360").
function buildListParagraphXml(text: string, ilvl: number): string {
  const indentTwips = 720 * (ilvl + 1);
  const lines = text.split("\n").map((line) => escapeXmlText(line));
  const runInner = lines.map((line) => `<w:t xml:space="preserve">${line}</w:t>`).join("<w:br/>");
  return (
    `<w:p><w:pPr><w:pageBreakBefore w:val="0"/><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="1"/></w:numPr>` +
    `<w:ind w:left="${indentTwips}" w:hanging="360"/>` +
    `<w:rPr><w:rFonts w:ascii="Georgia" w:cs="Georgia" w:eastAsia="Georgia" w:hAnsi="Georgia"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Georgia" w:cs="Georgia" w:eastAsia="Georgia" w:hAnsi="Georgia"/></w:rPr>` +
    `${runInner}</w:r></w:p>`
  );
}

// Fills the real Minutes template's Date and Meeting Call to Order
// fields, every officer heading's current holder + submitted report,
// and (Aug 2026) whatever's been added under Action Items/Old Business/
// Reminders/Announcements (see lib/meetingNotes.ts) — each inserted one
// list level deeper than its own heading, same nesting the template
// already uses for officer sub-reports (see buildListParagraphXml).
// Roll Call, Approval of Minutes/Agenda, and Meeting Adjourned are left
// as the template's own blank fields, filled in by hand — Adjourned
// deliberately excluded from this on request, unlike the other four.
export async function buildMeetingMinutesDocx(
  meeting: Meeting,
  reports: OfficerReport[],
  members: Pick<Member, "name" | "role" | "status" | "email">[],
  notes: Pick<MeetingNote, "category" | "text">[] = []
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
  // members, alphabetically by name. Each row is Name | Email — first
  // pass (stride=2) fills only the Name cells, leaving the Email cells
  // as still-empty runs; second pass (default stride=1) then fills
  // every *remaining* empty run in that same table, which by then is
  // exactly the Email column, no offset parameter needed.
  const term = currentTerm(parseIsoDateLocal(meeting.date));
  xml = replaceRunText(xml, "Active Roster Fall 2023", `Active Roster ${term}`);
  const activeMembers = members
    .filter((m) => m.status === "ACTIVE")
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, ACTIVE_ROSTER_ROW_CAPACITY);
  xml = fillTableCellsAfterHeader(
    xml,
    `Active Roster ${term}`,
    activeMembers.map((m) => m.name),
    2
  );
  xml = fillTableCellsAfterHeader(
    xml,
    `Active Roster ${term}`,
    activeMembers.map((m) => m.email ?? "")
  );

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

  // Action Items / Old Business / Reminders / Announcements — each
  // inserted as one batch (not one insertParagraphsAfter call per note)
  // so multiple entries land in the order they were added rather than
  // reversed: every call re-finds the *same* heading paragraph by its
  // unchanged text and inserts right after its close tag, so a second
  // standalone call would land its content ahead of the first call's.
  const notesByCategory = new Map<string, string[]>();
  for (const note of notes) {
    const list = notesByCategory.get(note.category) ?? [];
    list.push(note.text);
    notesByCategory.set(note.category, list);
  }
  const actionItems = notesByCategory.get("ACTION_ITEM") ?? [];
  if (actionItems.length > 0) {
    xml = insertParagraphsAfter(xml, "Action Items", actionItems.map((t) => buildListParagraphXml(t, 2)).join(""));
  }
  const oldBusiness = notesByCategory.get("OLD_BUSINESS") ?? [];
  if (oldBusiness.length > 0) {
    xml = insertParagraphsAfter(xml, "Old Business", oldBusiness.map((t) => buildListParagraphXml(t, 1)).join(""));
  }
  const reminders = notesByCategory.get("REMINDER") ?? [];
  if (reminders.length > 0) {
    xml = replaceRunText(xml, "Reminders: N/A", "Reminders:");
    xml = insertParagraphsAfter(xml, "Reminders:", reminders.map((t) => buildListParagraphXml(t, 1)).join(""));
  }
  const announcements = notesByCategory.get("ANNOUNCEMENT") ?? [];
  if (announcements.length > 0) {
    xml = insertParagraphsAfter(
      xml,
      "Announcements: ",
      announcements.map((t) => buildListParagraphXml(t, 1)).join("")
    );
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
