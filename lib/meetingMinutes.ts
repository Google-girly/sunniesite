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
// ever needs re-deriving. `Auditor` (also Sept 2026) was added the same
// way, after the master turned out to already list it as a real,
// distinct position the app's old bundled list was missing.
import { OFFICER_POSITIONS, type OfficerPosition } from "@/lib/positions";

export const OFFICER_REPORT_TEMPLATE_LABELS: Record<OfficerPosition, string> = {
  President: "President ",
  "Vice President": "Vice President ",
  "Sergeant-At-Arms": "Sergeant-at-Arms ",
  Treasurer: "Treasurer ",
  "Vice President of Communications": "Vice President of Communications ",
  Auditor: "Auditor ",
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
