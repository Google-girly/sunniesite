// Shared Community Service constants + math — used by both the API
// routes (validation) and the UI.

// Chapter Standing Rules Article IX: 30 hours/academic year (10/quarter
// or 15/semester), of which at least 10 must support the Chapter's
// designated Philanthropy and at least 10 must raise awareness for/
// support survivors of sexual assault. The remainder can be any
// qualifying service. `category` isn't on the real hour-log template
// (see lib/communityServiceExport.ts) — it's here purely so the app can
// show progress against these two sub-minimums, not just a total.
export const SERVICE_CATEGORIES = ["PHILANTHROPY", "SURVIVOR_SUPPORT", "GENERAL"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  PHILANTHROPY: "Philanthropy",
  // Aug 2026 — displayed label only; the stored category value stays
  // SURVIVOR_SUPPORT (renaming that would mean backfilling every
  // existing ServiceHourEntry row for no functional reason).
  SURVIVOR_SUPPORT: "Sexual Assault Awareness",
  GENERAL: "General",
};

export function isServiceCategory(value: string): value is ServiceCategory {
  return (SERVICE_CATEGORIES as readonly string[]).includes(value);
}

export const ANNUAL_HOURS_REQUIRED = 30;
export const PHILANTHROPY_HOURS_REQUIRED = 10;
export const SURVIVOR_SUPPORT_HOURS_REQUIRED = 10;

export interface ServiceHourEntryLike {
  hours: number;
  category: string;
}

export interface ServiceTotals {
  total: number;
  philanthropy: number;
  survivorSupport: number;
  general: number;
}

export function calculateServiceTotals(entries: ServiceHourEntryLike[]): ServiceTotals {
  return entries.reduce(
    (totals, entry) => {
      totals.total += entry.hours;
      if (entry.category === "PHILANTHROPY") totals.philanthropy += entry.hours;
      else if (entry.category === "SURVIVOR_SUPPORT") totals.survivorSupport += entry.hours;
      else totals.general += entry.hours;
      return totals;
    },
    { total: 0, philanthropy: 0, survivorSupport: 0, general: 0 }
  );
}

// A rough academic-term label for the export header ("Term: Fall 2026")
// — Winter/Spring Jan-May, Summer Jun-Jul, Fall Aug-Dec. Chapters vary on
// quarter vs. semester systems and exact boundaries, so this is a
// starting guess the Treasurer/VP can always override by hand on the
// exported sheet, not a source of truth the app enforces anywhere.
export function currentTerm(date: Date = new Date()): string {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  if (month <= 5) return `Spring ${year}`;
  if (month <= 7) return `Summer ${year}`;
  return `Fall ${year}`;
}

// The real submitted forms mark which of the two required sub-minimums
// (§C.3's designated Philanthropy, §C.4's survivor-support) an entry
// counts toward with a letter prefix on the event name — "P - Canned
// Food Drive" / "S - Denim Day." General-category entries aren't
// prefixed since they don't count toward either sub-minimum. Shared so
// the per-member Hour Log export and the compiled Chapter Standards
// C3/C4 report stay consistent — the report export was missing this
// entirely at first (only the Hour Log had it), which is exactly the
// kind of drift that makes "which hours count as Philanthropy" hard to
// audit from the submitted report alone.
export function categorizedEventText(entry: { category: string; event: string }): string {
  if (entry.category === "PHILANTHROPY") return `P - ${entry.event}`;
  if (entry.category === "SURVIVOR_SUPPORT") return `S - ${entry.event}`;
  return entry.event;
}

export function formatServiceDate(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
