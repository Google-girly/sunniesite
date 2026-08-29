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
  | "event-reports"
  | "letters";

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
  // Any logged-in member can create/download her own letters
  // (open-submit); no extra `positions`, so only the President
  // (ownsModule's always-true case) can see everyone's — see
  // app/api/letters/route.ts and MODULES.md.
  letters: { pattern: "open-submit" },
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

// Holds ANY officer position at all (Aug 2026 — Meeting Minutes' editing
// page is officer-only: "I only want this page to be accessable to
// officers"). Deliberately not the same thing as ownsModule/
// canAccessModule below, which are per-module — this is a standalone
// "is she an officer at all" check.
export function isOfficer(member: Pick<Member, "role"> | null | undefined): boolean {
  return parseRoles(member?.role ?? null).length > 0;
}

// Who can approve/deny a self-signup (Aug 2026 — see
// components/PendingSignupsPanel.tsx and app/api/officers/pending). Not tied to
// a Chapter Standards module the way MODULE_ACCESS above is, so it's
// its own check rather than living in that table — President's request
// verbatim: "prez, coms, or vp."
export function canApproveSignups(member: Pick<Member, "role"> | null | undefined): boolean {
  return (
    isPresident(member) ||
    holdsPosition(member, "Vice President") ||
    holdsPosition(member, "Vice President of Communications")
  );
}

// Who can assign/edit a member's position(s) from Manage Officers &
// Logins (Aug 2026 — "President coms and vp should be able to edit
// positions"). Same three roles as canApproveSignups above (and not
// coincidentally — it's one shared page now, see
// app/(app)/officers/page.tsx), but kept as its own named check since
// the two are conceptually different capabilities that just happen to
// currently share a role list; not a Chapter Standards module either.
// Setting/revoking another member's *password*, and sending sign-up
// invites, both stay President-only within that same page — narrower
// on purpose, since those touch account security rather than Roster
// data — see app/api/officers/[id]/password and app/api/officers/invite.
export function canEditPositions(member: Pick<Member, "role"> | null | undefined): boolean {
  return (
    isPresident(member) ||
    holdsPosition(member, "Vice President") ||
    holdsPosition(member, "Vice President of Communications")
  );
}

/** Does this member own/manage the module — i.e. bypass self-service row scoping, gate open-submit's sensitive actions, or unlock a locked module? */
export function ownsModule(member: Pick<Member, "role"> | null | undefined, moduleKey: ModuleKey): boolean {
  if (isPresident(member)) return true;
  const positions = MODULE_ACCESS[moduleKey]?.positions;
  if (!positions) return false;
  return positions.some((p) => holdsPosition(member, p));
}

// A GENERAL-status member who holds no officer position at all (Aug
// 2026 — "sisters who just want accounts to keep up with the chapter
// but not be active... they should be able to see meeting minutes, the
// calendar and be able to submit letters"). Deliberately narrow: an
// officer who happens to be marked GENERAL for some odd reason keeps
// her normal position-based access — this only strips access from
// someone who is *both* GENERAL and holds no position.
const OBSERVER_ALLOWED_MODULES: ModuleKey[] = ["calendar", "letters"];

export function isGeneralOnlyMember(member: Pick<Member, "role" | "status"> | null | undefined): boolean {
  if (!member) return false;
  return member.status === "GENERAL" && !isOfficer(member);
}

/** Can this member open the module's page/API at all? False for "locked" modules she doesn't own, and for everything outside OBSERVER_ALLOWED_MODULES if she's a GENERAL-status, no-position member. */
export function canAccessModule(
  member: Pick<Member, "role" | "status"> | null | undefined,
  moduleKey: ModuleKey
): boolean {
  if (!member) return false;
  if (isGeneralOnlyMember(member) && !OBSERVER_ALLOWED_MODULES.includes(moduleKey)) return false;
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
