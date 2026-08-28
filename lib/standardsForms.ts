// Shared Official Standards Forms constants — used by both the API
// routes (validation) and the UI. Covers every Chapter Standards section
// that doesn't already have a home in another module: Community Service
// covers C3/C4 and C6 (see lib/communityService.ts); Study Hours covers
// B4 and B6 (see lib/studyHours.ts). Everything here is grounded in
// Chapter Standards Approved 08-2026, Sections B (Academics) and D
// (Sisterhood).

// Section B. Academics §1: minimum GPAs a member must maintain.
export const MIN_TERM_GPA = 2.3;
export const MIN_CUM_GPA = 2.5;

// Section B.3: Alpha Order recognizes a 3.0+ cumulative GPA.
export const ALPHA_ORDER_MIN_CUM_GPA = 3.0;

// Section D.4.
export const PROBATION_STATUSES = ["Probation", "Suspension"] as const;
export type ProbationStatus = (typeof PROBATION_STATUSES)[number];

// Section D.9: quorum is 2/3 (66%) of Active membership; officer
// attendance is "highly encouraged" at 90%+.
export const MEETING_QUORUM_THRESHOLD = 0.66;
export const OFFICER_ATTENDANCE_THRESHOLD = 0.9;
export const MEETINGS_PER_TERM = 10; // matches the real form's 10 pre-numbered rows

// Section D.10: the real form's fixed month list, September through
// June (the chapter's academic year) — not calendar-year order.
export const SISTER_OF_MONTH_MONTHS = [
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
] as const;
export type SisterOfMonthMonth = (typeof SISTER_OF_MONTH_MONTHS)[number];

// Section D.11: minimum 4 certified members required.
export const CPR_FIRST_AID_MIN_CERTIFIED = 4;
export const CERTIFICATION_TYPES = ["CPR", "FIRST_AID", "CPR_AND_FIRST_AID"] as const;
export type CertificationType = (typeof CERTIFICATION_TYPES)[number];
export const CERTIFICATION_TYPE_LABELS: Record<CertificationType, string> = {
  CPR: "CPR",
  FIRST_AID: "First Aid",
  CPR_AND_FIRST_AID: "CPR & First Aid",
};

export function isCertificationType(value: string): value is CertificationType {
  return (CERTIFICATION_TYPES as readonly string[]).includes(value);
}

export function isProbationStatus(value: string): value is ProbationStatus {
  return (PROBATION_STATUSES as readonly string[]).includes(value);
}

export function isSisterOfMonthMonth(value: string): value is SisterOfMonthMonth {
  return (SISTER_OF_MONTH_MONTHS as readonly string[]).includes(value);
}

// A member qualifies for Mentorship (§B.2) or falls short of Alpha Order
// (§B.3) based on the same two thresholds — small helpers so the UI and
// API agree on the definition.
export function isBelowGpaRequirement(termGpa: number | null, cumGpa: number | null): boolean {
  return (termGpa != null && termGpa < MIN_TERM_GPA) || (cumGpa != null && cumGpa < MIN_CUM_GPA);
}

export function qualifiesForAlphaOrder(cumGpa: number | null): boolean {
  return cumGpa != null && cumGpa >= ALPHA_ORDER_MIN_CUM_GPA;
}

// --- Additional sections (A.4, F.4-F.7, G.4, G.6) -------------------------
// See lib/standardsFormsLetters.ts for the exports these back.

// Section F.4: transitions must be complete before July 1st, for the
// academic year that's about to start — "2026-2027" means the Fall 2026
// through Spring/Summer 2027 cycle. July onward counts as the start of
// the *next* academic year rather than the one ending, matching how
// Chapter Standards itself frames the July 1st cutoff.
export function currentAcademicYear(date: Date = new Date()): string {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// Section F.5: the plan "must address, at minimum" these four areas.
export const STRATEGIC_PRIORITY_AREAS = [
  "Membership Development",
  "Academic Excellence",
  "Community Service / Philanthropy",
  "Chapter Operations / Financial Stability",
  "Other",
] as const;
export type StrategicPriorityArea = (typeof STRATEGIC_PRIORITY_AREAS)[number];

export const STRATEGIC_GOAL_STATUSES = ["Not Started", "In Progress", "Completed", "At Risk"] as const;
export type StrategicGoalStatus = (typeof STRATEGIC_GOAL_STATUSES)[number];

// The real requirement is one annual plan, but the chapter wanted the
// option to run a Fall-only or Spring-only plan instead of always a
// full-year one — a second filter dimension alongside academicYear, not
// a second kind of record (Aug 2026).
export const PLAN_PERIODS = ["YEAR", "SPRING", "FALL"] as const;
export type PlanPeriod = (typeof PLAN_PERIODS)[number];
export const PLAN_PERIOD_LABELS: Record<PlanPeriod, string> = {
  YEAR: "Full Year",
  SPRING: "Spring",
  FALL: "Fall",
};
export function isPlanPeriod(value: string): value is PlanPeriod {
  return (PLAN_PERIODS as readonly string[]).includes(value);
}

// Section F.6 vs F.7 — same documentation format, separate credits (each
// capped at 20 points / 5 per position) depending on whether the outside
// organization is Greek-related.
export const LEADERSHIP_CATEGORIES = ["GREEK", "NON_GREEK"] as const;
export type LeadershipCategory = (typeof LEADERSHIP_CATEGORIES)[number];
export const LEADERSHIP_CATEGORY_LABELS: Record<LeadershipCategory, string> = {
  GREEK: "Greek Related (§F.6)",
  NON_GREEK: "Non-Greek Related (§F.7)",
};

export function isLeadershipCategory(value: string): value is LeadershipCategory {
  return (LEADERSHIP_CATEGORIES as readonly string[]).includes(value);
}
