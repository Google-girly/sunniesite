// Single source of truth for the Template Library section of Official
// Standards Forms — a storage place for every blank template the
// chapter uses, plus a pointer to where to go for a real filled-in
// version from current data. Every module keeps generating its own
// live export the same way it always has (see MODULES.md); this is
// purely a read-only index over lib/templates/ for the raw files.
//
// `key` doubles as the URL segment for app/api/templates/[key] and must
// stay stable — it's not shown anywhere, just used to look up the file.
export interface TemplateLibraryEntry {
  key: string;
  title: string;
  description: string;
  /** Filename inside lib/templates/. */
  file: string;
  /** Filename offered to the browser when downloading. */
  downloadName: string;
  contentType: string;
  /** Where to go in-app for a real filled-in version, if applicable. */
  liveHref?: string;
}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const TEMPLATE_LIBRARY: TemplateLibraryEntry[] = [
  {
    key: "meeting-minutes",
    title: "Meeting Minutes",
    description: "Blank general meeting minutes template.",
    file: "meeting-minutes-template.docx",
    downloadName: "Theta Chapter Meeting Minutes Template.docx",
    contentType: DOCX,
    liveHref: "/meetings-reports/minutes",
  },
  {
    key: "study-hours",
    title: "Study Hours Log",
    description: "Weekly library study hour log, Chapter Standards §B.4/§B.6.",
    file: "study-hours-template.xlsx",
    downloadName: "Theta Chapter Study Hours Template.xlsx",
    contentType: XLSX,
    liveHref: "/study-hours",
  },
  {
    key: "budgets",
    title: "Event Budget",
    description: "SON expense budget form for a single event.",
    file: "son-expense-budget-template.xlsx",
    downloadName: "Theta Chapter Event Budget Template.xlsx",
    contentType: XLSX,
    liveHref: "/budgets",
  },
  {
    key: "community-service-hours",
    title: "Community Service Hours Log",
    description: "Individual community service hour log, Chapter Standards §C.3/§C.4.",
    file: "community-service-template.xlsx",
    downloadName: "Theta Chapter Community Service Hours Template.xlsx",
    contentType: XLSX,
    liveHref: "/community-service",
  },
  {
    key: "community-service-report",
    title: "Community Service Report",
    description: "Chapter Standards §C.6 community service summary report.",
    file: "community-service-report-template.xlsx",
    downloadName: "Theta Chapter Community Service Report Template.xlsx",
    contentType: XLSX,
    liveHref: "/community-service",
  },
  {
    key: "pledgeship",
    title: "Pledgeship Forms",
    description: "National induction/initiation paperwork for the New Member Class.",
    file: "pledgeship-forms-template.xlsx",
    downloadName: "Theta Chapter Pledgeship Forms Template.xlsx",
    contentType: XLSX,
    // No `liveHref` — the standalone Pledgeship module was removed
    // (Aug 2026, see MODULES.md); this is now just a blank download.
  },
  {
    key: "financial-books",
    title: "Financial Books",
    description: "Chapter-wide rollup of every approved event's Final Budget spend.",
    file: "financial-books-template.xlsx",
    downloadName: "Theta Chapter Financial Books Template.xlsx",
    contentType: XLSX,
    liveHref: "/finances",
  },
  {
    key: "standards-forms",
    title: "Official Standards Forms",
    description:
      "Sections B1, B2, B3, B5, D4, D9, D10, D11 — also reused as-is for Study Hours' §B.4/§B.6 report.",
    file: "standards-forms-template.xlsx",
    downloadName: "Theta Chapter Official Standards Forms Template.xlsx",
    contentType: XLSX,
    liveHref: "/standards-forms",
  },
];
