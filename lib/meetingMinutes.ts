// Shared Meeting Minutes constants — used by both the API routes and the
// UI. The report positions are OFFICER_POSITIONS (lib/positions.ts) —
// same canonical list Roster/Budgets already use — mapped to the real
// Minutes template's own heading text, which differs from the app's own
// wording in several spots ("VP of Communications" not "Vice President
// of Communications," "Cultura & Sisterhood" not "Commissioner of
// Cultura and Sisterhood," etc. — this template drops "Commissioner of"
// entirely for several positions). See lib/meetingMinutesExport.ts for
// where this map is actually used to find/patch each heading — each
// entry here is the exact text of that heading's *label* run (not the
// full "Label ()" — the template splits the label and the "()"
// placeholder into separate runs for almost every heading).
//
// `Auditor` (Sept 2026) — added to OFFICER_POSITIONS after the new
// "Officer & Active Roster Template.xlsx" and "Meeting Agenda_Minutes -
// MO.DAY.YEAR.docx" (Organizational Structure/Example Forms-Templates/)
// both listed it as a real, distinct officer position the old bundled
// list was missing. Its heading was hand-added to
// lib/templates/meeting-minutes-template.docx right after "VP of
// Communications," matching where the new template places it.
import { OFFICER_POSITIONS, type OfficerPosition } from "@/lib/positions";

export const OFFICER_REPORT_TEMPLATE_LABELS: Record<OfficerPosition, string> = {
  President: "President ",
  "Vice President": "Vice President ",
  "Sergeant-At-Arms": "Sergeant At Arms",
  Treasurer: "Treasurer ",
  "Vice President of Communications": "VP of Communications ",
  Auditor: "Auditor ",
  "Risk Management Officer": "Risk Management ",
  "Commissioner of Cultura and Sisterhood": "Cultura & Sisterhood ",
  "Commissioner of Community Service": "Community Service ",
  "Commissioner of Fundraising": "Fundraising ",
  "Commissioner of Alumnae Relations": "Alumnae Relations",
  "Commissioner of Social Affairs": "Social Affairs ",
  "Commissioner of Public Relations": "Public Relations ",
  Historian: "Historian ",
  "Pledge Mother": "Pledge Mother ",
  "University Representative": "University Representative(s)",
  "National Board Representative": "National Board Representative(s) ",
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
