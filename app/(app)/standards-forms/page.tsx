import { redirect } from "next/navigation";
import { TemplateLibrarySection } from "@/components/TemplateLibrarySection";
import { CPR_FIRST_AID_MIN_CERTIFIED } from "@/lib/standardsForms";
import { currentAcademicYear } from "@/lib/standardsForms";
import { currentTermLabel, currentTermRange } from "@/lib/studyHours";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { canAccessModule } from "@/lib/permissions";
import { NotAuthorized } from "@/components/NotAuthorized";
import { ChapterStandardsChecklistClient } from "./ChapterStandardsChecklistClient";
import { ChecklistDocumentsSection } from "./ChecklistDocumentsSection";

// Official Standards Forms — as of Aug 2026, a pure checklist over
// every Chapter Standards credit (Sections A-I), not a data-entry page.
// Every credit that has somewhere to actually enter data now lives on
// its own module page (Academics, Sisterhood, Leadership, Event
// Reports, Study Hours, Community Service, Budgets, Chapter Finances,
// Fines & Member Accounts, Roster) — this page just reads that data
// back and shows it as a hint. See lib/chapterStandardsChecklist.ts for
// the full item list and MODULES.md for why this got split up.
export default async function StandardsFormsPage() {
  const viewer = await getCurrentMember();
  if (!viewer) redirect("/login");
  if (!canAccessModule(viewer, "standards-forms")) {
    return <NotAuthorized moduleTitle="Official Standards Forms" positions={[]} />;
  }

  const term = currentTermLabel();
  const { start, end } = currentTermRange();
  const academicYear = currentAcademicYear();
  const currentYear = new Date().getFullYear();

  const [
    gpaCount,
    mentorshipCount,
    alphaOrderCount,
    professionalDevelopmentCount,
    studyHoursActiveCount,
    studyHoursInactiveCount,
    eventReportSections,
    serviceHourCount,
    incompleteMakeUpCount,
    meetingAttendanceCount,
    sisterOfMonthCount,
    certificationCount,
    strategicPlanCount,
    leadershipGreekCount,
    leadershipNonGreekCount,
    accountEntryCount,
    chapterFundEntryCount,
    finalBudgetCount,
    chapterAdvisorCount,
    overrides,
  ] = await Promise.all([
    prisma.gpaRecord.count({ where: { term } }),
    prisma.mentorship.count({ where: { term } }),
    prisma.alphaOrderRecord.count({ where: { term } }),
    prisma.professionalDevelopmentEvent.count({ where: { term } }),
    prisma.studyHourEntry.count({ where: { date: { gte: start, lte: end }, member: { status: "ACTIVE" } } }),
    prisma.studyHourEntry.count({ where: { date: { gte: start, lte: end }, member: { status: "INACTIVE" } } }),
    prisma.eventReport.groupBy({ by: ["standardSection"], _count: true }),
    prisma.serviceHourEntry.count(),
    prisma.makeUpProject.count({ where: { completed: false } }),
    prisma.meetingAttendanceRecord.count({ where: { term } }),
    prisma.sisterOfTheMonth.count({ where: { year: currentYear } }),
    prisma.certificationRecord.count(),
    prisma.strategicPlanGoal.count({ where: { academicYear } }),
    prisma.leadershipPosition.count({ where: { category: "GREEK", academicYear } }),
    prisma.leadershipPosition.count({ where: { category: "NON_GREEK", academicYear } }),
    prisma.accountEntry.count(),
    prisma.chapterFundEntry.count(),
    prisma.budgetVersion.count({ where: { stage: "FINAL" } }),
    prisma.chapterAdvisor.count(),
    prisma.checklistOverride.findMany(),
  ]);

  const eventReportCodes = new Set(eventReportSections.map((s) => s.standardSection));
  const hasEventReport = (code: string) => eventReportCodes.has(code);

  const statuses: Record<string, boolean> = {
    "eventReport:A.3": hasEventReport("A.3"),
    chapterAdvisor: chapterAdvisorCount > 0,
    gpa: gpaCount > 0,
    mentorship: mentorshipCount > 0,
    alphaOrder: alphaOrderCount > 0,
    studyHoursActive: studyHoursActiveCount > 0,
    professionalDevelopment: professionalDevelopmentCount > 0,
    studyHoursInactive: studyHoursInactiveCount > 0,
    "eventReport:C.1": hasEventReport("C.1"),
    "eventReport:C.2": hasEventReport("C.2"),
    communityService: serviceHourCount > 0,
    "eventReport:C.5": hasEventReport("C.5"),
    communityServiceMakeUp: incompleteMakeUpCount === 0,
    "eventReport:C.7": hasEventReport("C.7"),
    "eventReport:D.3": hasEventReport("D.3"),
    "eventReport:D.5": hasEventReport("D.5"),
    "eventReport:D.6": hasEventReport("D.6"),
    "eventReport:D.7": hasEventReport("D.7"),
    meetingAttendance: meetingAttendanceCount > 0,
    "eventReport:D.9": hasEventReport("D.9"),
    sisterOfMonth: sisterOfMonthCount > 0,
    certification: certificationCount >= CPR_FIRST_AID_MIN_CERTIFIED,
    "eventReport:E.3": hasEventReport("E.3"),
    "eventReport:E.6": hasEventReport("E.6"),
    "eventReport:F.4": hasEventReport("F.4"),
    strategicPlan: strategicPlanCount > 0,
    leadershipGreek: leadershipGreekCount > 0,
    leadershipNonGreek: leadershipNonGreekCount > 0,
    memberAccounts: accountEntryCount > 0,
    chapterAccount: chapterFundEntryCount > 0,
    budgeting: finalBudgetCount > 0,
    "eventReport:H.1": hasEventReport("H.1"),
    "eventReport:H.3": hasEventReport("H.3"),
    "eventReport:H.6": hasEventReport("H.6"),
    "eventReport:H.7": hasEventReport("H.7"),
    "eventReport:H.8": hasEventReport("H.8"),
    "eventReport:H.9": hasEventReport("H.9"),
  };

  const documents = await prisma.checklistDocument.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, label: true, fileName: true, mimeType: true, uploadedByName: true, createdAt: true },
  });
  const documentCounts: Record<string, number> = {};
  for (const d of documents) documentCounts[d.code] = (documentCounts[d.code] ?? 0) + 1;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Official Standards Forms</h1>

      <div className="mt-6 space-y-4">
        <TemplateLibrarySection />
        <ChecklistDocumentsSection initialDocuments={documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))} />
        <ChapterStandardsChecklistClient statuses={statuses} initialOverrides={overrides} documentCounts={documentCounts} />
      </div>
    </div>
  );
}
