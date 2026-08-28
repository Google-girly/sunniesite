// Which position(s) own which module (Aug 2026) — the framework behind
// "make each function specific to each individual position." Built on
// top of lib/session.ts (who's logged in) and each Member's existing
// `role` field (comma-separated OFFICER_POSITIONS, parsed via
// lib/roster.ts parseRoles — the same field Roster already edited, now
// also the source of truth for access). President always has full
// access everywhere, in addition to whatever's listed below — she
// doesn't need to be named on every module.
//
// Four access patterns:
//  - "open": every logged-in member has full access. No owner.
//  - "locked": only the owning position(s) (+ President) can even open
//    the module. Everyone else is turned away entirely.
//  - "self-service": every logged-in member can use the module, but
//    only for HER OWN records (Study Hours, Community Service) — the
//    owning position (+ President) can see/manage everyone's. Row-level
//    scoping happens in each module's own page/route via `ownsModule()`
//    + `member.id === record.memberId`, not here.
//  - "open-submit": every logged-in member can create/view/edit records
//    freely (this is the "sorority-wide" carve-out — e.g. anyone can
//    submit a budget for her own event) but specific higher-stakes
//    actions (approving a Final Budget, exporting Financial Books) are
//    gated per-route to the owning position via `ownsModule()` — there's
//    no single record-owner field to check generically the way
//    self-service modules have `memberId`, so those routes call
//    `ownsModule()` directly rather than through a shared helper here.
import type { Member } from "@/app/generated/prisma/client";
import { parseRoles } from "@/lib/roster";
import type { OfficerPosition } from "@/lib/positions";

export type AccessPattern = "open" | "locked" | "self-service" | "open-submit";

export interface ModuleAccessRule {
  pattern: AccessPattern;
  /** Position(s) that own/manage this module, beyond President (always allowed). */
  positions?: OfficerPosition[];
}

export type ModuleKey =
  | "calendar"
  | "roster"
  | "budgets"
  | "finances"
  | "fines"
  | "community-service"
  | "academics"
  | "sisterhood"
  | "leadership"
  | "study-hours"
  | "meetings-reports"
  | "standards-forms"
  | "event-reports";

// See MODULES.md's "Positions & Permissions" entry for the reasoning
// behind each of these — a few are genuine judgment calls (no "VP of
// Academics" or Secretary-equivalent position exists on the real
// roster) flagged there for the President to correct if wrong.
export const MODULE_ACCESS: Record<ModuleKey, ModuleAccessRule> = {
  // Read-only for everyone (a public Google Calendar embed) — nothing
  // here to own or lock down.
  calendar: { pattern: "open" },
  // President-only (Aug 2026, narrowed from Vice President of
  // Communications on request) — no `positions` beyond President
  // herself, who always has access regardless of what's listed here.
  roster: { pattern: "locked" },
  budgets: { pattern: "open-submit", positions: ["Treasurer"] },
  finances: { pattern: "locked", positions: ["Treasurer"] },
  fines: { pattern: "locked", positions: ["Treasurer"] },
  "community-service": { pattern: "self-service", positions: ["Commissioner of Community Service"] },
  academics: { pattern: "locked", positions: ["Vice President"] },
  sisterhood: { pattern: "locked", positions: ["Commissioner of Cultura and Sisterhood"] },
  leadership: { pattern: "locked", positions: ["President"] },
  "study-hours": { pattern: "self-service", positions: ["Vice President"] },
  // Open-submit, not locked — every officer needs to submit her own
  // Officer Report each meeting (gated per-report to the position she
  // actually holds, not per-module — see app/api/meeting-minutes/reports),
  // so locking the whole module to one position would block the exact
  // thing most people use it for. Vice President of Communications is
  // the chapter's real Secretary-equivalent (confirmed by the
  // President), joined by Historian on request — the two of them (plus
  // President, always) own the recurring meeting schedule, creating/
  // editing/deleting a meeting record, and exporting the final compiled
  // Minutes. Submitting an Officer Report stays open to everyone.
  "meetings-reports": {
    pattern: "open-submit",
    positions: ["Vice President of Communications", "Historian"],
  },
  "standards-forms": { pattern: "open" },
  "event-reports": { pattern: "open-submit" },
};

export function holdsPosition(
  member: Pick<Member, "role"> | null | undefined,
  position: OfficerPosition
): boolean {
  if (!member) return false;
  return parseRoles(member.role).includes(position);
}

export function isPresident(member: Pick<Member, "role"> | null | undefined): boolean {
  return holdsPosition(member, "President");
}

/** Does this member own/manage the module — i.e. bypass self-service row scoping, gate open-submit's sensitive actions, or unlock a locked module? */
export function ownsModule(member: Pick<Member, "role"> | null | undefined, moduleKey: ModuleKey): boolean {
  if (isPresident(member)) return true;
  const positions = MODULE_ACCESS[moduleKey]?.positions;
  if (!positions) return false;
  return positions.some((p) => holdsPosition(member, p));
}

/** Can this member open the module's page/API at all? False only for "locked" modules she doesn't own. */
export function canAccessModule(member: Pick<Member, "role"> | null | undefined, moduleKey: ModuleKey): boolean {
  if (!member) return false;
  const pattern = MODULE_ACCESS[moduleKey]?.pattern ?? "open";
  if (pattern !== "locked") return true;
  return ownsModule(member, moduleKey);
}

/** For self-service modules: can this member touch the given record's owner? Her own records, always; anyone's if she owns the module. */
export function canManageRecord(
  member: Pick<Member, "id" | "role"> | null | undefined,
  moduleKey: ModuleKey,
  recordMemberId: string
): boolean {
  if (!member) return false;
  if (member.id === recordMemberId) return true;
  return ownsModule(member, moduleKey);
}
