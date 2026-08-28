// Builds the "Official Letterhead" letter for every additional Chapter
// Standards credit found while auditing full coverage against the real
// document (§A.4, §F.5 ×2 variants, §F.6/§F.7) — none of these have a
// designated national spreadsheet the way B1-B6 etc. do (see
// lib/standardsFormsExport.ts), so §I.2's own fallback rule applies:
// "All credits that do not have a designated spreadsheet, form or
// format are submitted on Official Letterhead." All share the one
// generic builder in lib/docxLetterhead.ts. (§F.4 Officer Transition
// Meetings used to be here too — removed Aug 2026 in favor of an Event
// Report, see lib/eventReports.ts.)
import type { ChapterAdvisor, LeadershipPosition, StrategicPlanGoal } from "@/app/generated/prisma/client";
import {
  blankParagraph,
  buildLetterheadDocx,
  fieldParagraph,
  twoFieldParagraph,
  type LetterSignature,
} from "@/lib/docxLetterhead";
import { LEADERSHIP_CATEGORY_LABELS, PLAN_PERIOD_LABELS, type LeadershipCategory, type PlanPeriod } from "@/lib/standardsForms";

// §A.4 — no signature required by the standard itself, just contact info.
export async function buildChapterAdvisorLetter(advisors: ChapterAdvisor[]): Promise<Uint8Array> {
  const body = advisors.flatMap((a, i) => [
    ...(i > 0 ? [blankParagraph()] : []),
    fieldParagraph("Name: ", a.name),
    fieldParagraph("Position/Title: ", a.title),
    fieldParagraph("Email: ", a.email),
    fieldParagraph("Phone: ", a.phone),
    fieldParagraph("Office Address: ", a.officeAddress),
  ]);
  return buildLetterheadDocx({ title: "CHAPTER ADVISOR", bodyParagraphs: body });
}
export function chapterAdvisorLetterFilename(): string {
  return "chapter-advisor-A4.docx";
}

// §F.5 — the Annual Strategic Plan (due 9/15) and its Progress Report
// (due 1/31) are the *same* goal records; the Progress Report variant
// just also prints status/progress notes. `period` (Aug 2026) filters
// which of a year's goals this letter covers — Year-round, Spring-only,
// or Fall-only — since the chapter runs separate plans per term rather
// than always one annual one.
export async function buildStrategicPlanLetter(
  academicYear: string,
  goals: StrategicPlanGoal[],
  signature: LetterSignature,
  variant: "PLAN" | "PROGRESS",
  period: PlanPeriod
): Promise<Uint8Array> {
  const body = [
    twoFieldParagraph("Academic Year: ", academicYear, "Period: ", PLAN_PERIOD_LABELS[period]),
    ...goals.flatMap((g) => [
      blankParagraph(),
      fieldParagraph("Priority Area: ", g.priorityArea),
      fieldParagraph("Goal: ", g.goalDescription),
      twoFieldParagraph(
        "Responsible Officer: ",
        g.responsibleOfficer ?? "",
        "Target Timeline: ",
        g.targetTimeline ?? ""
      ),
      ...(variant === "PROGRESS"
        ? [fieldParagraph("Status: ", g.status), fieldParagraph("Progress Notes: ", g.progressNotes)]
        : []),
    ]),
  ];
  return buildLetterheadDocx({
    title: variant === "PLAN" ? "ANNUAL STRATEGIC PLAN" : "STRATEGIC PLAN PROGRESS REPORT",
    bodyParagraphs: body,
    signature,
  });
}
export function strategicPlanLetterFilename(academicYear: string, variant: "PLAN" | "PROGRESS", period: PlanPeriod): string {
  const suffix = variant === "PLAN" ? "plan-F5" : "progress-report-F5";
  return `strategic-${suffix}-${period.toLowerCase()}-${academicYear}.docx`;
}

// §F.6/§F.7 — no signature required by the standard, just a list.
export async function buildLeadershipPositionsLetter(
  academicYear: string,
  positions: LeadershipPosition[],
  category: LeadershipCategory
): Promise<Uint8Array> {
  const body = [
    fieldParagraph("Academic Year: ", academicYear),
    ...positions.flatMap((p) => [
      blankParagraph(),
      twoFieldParagraph("Member: ", p.memberName, "Position Held: ", p.position),
      fieldParagraph("Organization: ", p.organization),
    ]),
  ];
  return buildLetterheadDocx({
    title: `INDIVIDUAL LEADERSHIP POSITIONS — ${LEADERSHIP_CATEGORY_LABELS[category].replace(/ \(§F\.\d\)$/, "")}`,
    bodyParagraphs: body,
  });
}
export function leadershipPositionsLetterFilename(academicYear: string, category: LeadershipCategory): string {
  const suffix = category === "GREEK" ? "greek-F6" : "non-greek-F7";
  return `leadership-positions-${suffix}-${academicYear}.docx`;
}

