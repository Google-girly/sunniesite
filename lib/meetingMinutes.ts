// Shared Meeting Minutes constants — used by both the API routes and the
// UI. The report positions are OFFICER_POSITIONS (lib/positions.ts) —
// same canonical list Roster/Budgets already use — mapped to the real
// Minutes template's own heading text. See lib/meetingMinutesExport.ts
// for where this map is actually used to find/patch each heading — each
// entry here is the exact text of that heading's *label* run (not the
// full "Label ()" — the template splits the label and the "()"
// placeholder into separate runs for every heading).
//
// Sept 2026 — "it is still the old meeting minutes switch it out
// entirely." lib/templates/meeting-minutes-template.docx is now built
// directly from National's actual current master ("Meeting
// Agenda/Minutes - MO.DAY.YEAR.docx", Organizational Structure/Example
// Forms-Templates/) rather than a hand-patched older file, so these
// labels are now National's own full titles ("Commissioner of...,"
// "Vice President of Communications," "Sergeant-at-Arms") instead of
// the app's old shortened versions — see that docx directly if this
// ever needs re-deriving. `Auditor` (Sept 2026) was added the same way,
// then removed again in Oct 2026 on request — position, label, and its
// heading in the bundled template are all gone.
import { OFFICER_POSITIONS, type OfficerPosition } from "@/lib/positions";

export const OFFICER_REPORT_TEMPLATE_LABELS: Record<OfficerPosition, string> = {
  President: "President ",
  "Vice President": "Vice President ",
  "Sergeant-At-Arms": "Sergeant-at-Arms ",
  Treasurer: "Treasurer ",
  "Vice President of Communications": "Vice President of Communications ",
  "Risk Management Officer": "Risk Management ",
  "Commissioner of Cultura and Sisterhood": "Commissioner of Cultura and Sisterhood ",
  "Commissioner of Community Service": "Commissioner of Community Service ",
  "Commissioner of Fundraising": "Commissioner of Fundraising ",
  "Commissioner of Alumnae Relations": "Commissioner of Alumnae Relations ",
  "Commissioner of Social Affairs": "Commissioner of Social Affairs ",
  "Commissioner of Public Relations": "Commissioner of Public Relations ",
  Historian: "Historian ",
  "Pledge Mother": "Pledge Mother(s) ",
  "University Representative": "University Representative ",
  "National Board Representative": "National Board Representative ",
};

export { OFFICER_POSITIONS, type OfficerPosition };

export function formatMeetingDate(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Oct 2026 — "for my prez report I want to say Chapter Standards we have
// completed and then underneath list/tab what we need." An officer
// report is one numbered item per line; a line indented with a Tab (or
// 2 spaces) becomes a sub-item under the line above it, one level deeper
// per Tab. Shared by the on-screen view (MeetingMinutesClient) and the
// docx export (lib/meetingMinutesExport.ts) so both nest identically.
// Depth is capped at 4 (sub-sub-sub-items, on request — "subsections of
// subsections and subsections of those") and can only go one level
// deeper than the line before it, so a stray indent on the first line
// can't orphan anything. The template defines deeper levels still, but
// past ilvl 6 the indent leaves too little of the page to write on.
export const MAX_REPORT_DEPTH = 4;

export interface ReportLine {
  text: string;
  depth: number;
}

export function parseReportLines(report: string): ReportLine[] {
  const lines: ReportLine[] = [];
  for (const raw of report.split("\n")) {
    const text = raw.trim();
    if (!text) continue; // blank lines don't consume a number
    const leading = /^[ \t]*/.exec(raw)![0];
    const tabs = (leading.match(/\t/g) ?? []).length;
    const spaces = leading.length - tabs;
    const requested = tabs + Math.floor(spaces / 2);
    const maxAllowed = lines.length === 0 ? 0 : lines[lines.length - 1].depth + 1;
    lines.push({ text, depth: Math.min(requested, maxAllowed, MAX_REPORT_DEPTH) });
  }
  return lines;
}

// The label each nested report line gets — "1.", "a)", "(1)", "(a)",
// "(i)" by depth, matching the template's own list levels. Used for the
// on-screen view and written straight into the exported docx for
// sub-items (see buildReportParagraphXml), so labels show up even in
// viewers that skip Word's deeper auto-numbering.
function toLetter(n: number): string {
  return String.fromCharCode(96 + ((n - 1) % 26) + 1);
}

function toRoman(n: number): string {
  const numerals: [number, string][] = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let out = "";
  for (const [value, numeral] of numerals) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out;
}

function reportLabel(depth: number, n: number): string {
  switch (depth) {
    case 0:
      return `${n}.`;
    case 1:
      return `${toLetter(n)})`;
    case 2:
      return `(${n})`;
    case 3:
      return `(${toLetter(n)})`;
    default:
      return `(${toRoman(n)})`;
  }
}

export interface LabeledReportLine extends ReportLine {
  label: string;
}

// parseReportLines plus each line's label — counters restart under each
// new parent line.
export function labelReportLines(report: string): LabeledReportLine[] {
  const counters = Array<number>(MAX_REPORT_DEPTH + 1).fill(0);
  return parseReportLines(report).map((line) => {
    counters[line.depth] += 1;
    for (let d = line.depth + 1; d < counters.length; d++) counters[d] = 0;
    return { ...line, label: reportLabel(line.depth, counters[line.depth]) };
  });
}
