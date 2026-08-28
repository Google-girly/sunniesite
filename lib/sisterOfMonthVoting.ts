import type { SisterOfMonthMonth } from "@/lib/standardsForms";

// The ballot "auto-opens" in the sense that there's no explicit open/
// closed flag to manage — whatever academic-year month we're currently
// in (Sept-June) IS this month's voting period, full stop. It "closes"
// itself the moment a SisterOfTheMonth row exists for that (year,
// month) — see app/api/standards/sister-of-month/vote/route.ts — so
// there's nothing to keep in sync between "is voting open" and "has a
// winner been confirmed."
const CALENDAR_MONTH_TO_ACADEMIC: Record<number, SisterOfMonthMonth> = {
  8: "September",
  9: "October",
  10: "November",
  11: "December",
  0: "January",
  1: "February",
  2: "March",
  3: "April",
  4: "May",
  5: "June",
};

export interface VotingPeriod {
  year: number;
  month: SisterOfMonthMonth;
}

/** null during July/August — off-season, no chapter meetings to vote at. */
export function currentVotingPeriod(date: Date = new Date()): VotingPeriod | null {
  const month = CALENDAR_MONTH_TO_ACADEMIC[date.getMonth()];
  if (!month) return null;
  return { year: date.getFullYear(), month };
}
