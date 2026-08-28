// Shared roster constants — used by both the API routes (validation) and
// the UI (dropdown options + labels). Keeping status as a plain string
// union instead of a Prisma enum because SQLite has no native enum type.

export const MEMBER_STATUSES = [
  "ACTIVE",
  "ACTIVE_SPECIAL_CIRCUMSTANCE",
  "INACTIVE",
  "ACTIVE_ALUMNAE",
] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: "Active",
  ACTIVE_SPECIAL_CIRCUMSTANCE: "Active – Special Circumstance",
  INACTIVE: "Inactive",
  ACTIVE_ALUMNAE: "Active Alumnae",
};

export function isMemberStatus(value: string): value is MemberStatus {
  return (MEMBER_STATUSES as readonly string[]).includes(value);
}

// A member can hold more than one officer position at once, so `role`
// supports multiple — stored as a single comma-separated string
// (Member.role stays a plain String column; SQLite doesn't support
// scalar list fields), joined/split with the helpers below. An empty
// selection means "general member". The position list itself lives in
// lib/positions.ts since Budgets uses it too (for "Chair").
export function parseRoles(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

export function serializeRoles(roles: string[]): string | null {
  const cleaned = roles.map((r) => r.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(", ") : null;
}

// Used by Budgets to suggest "Submitted By" from whichever position was
// picked as "Chair" — e.g. Chair = "Sergeant-At-Arms" resolves to
// whoever currently holds that role on the roster. More than one person
// can hold the same position at once (see parseRoles above), so this
// returns all of them, joined — "Submitted By" stays a free-text field
// the treasurer can still edit if the suggestion is wrong.
export function findRoleHolderNames(
  members: { name: string; role: string | null }[],
  role: string
): string | null {
  const names = members.filter((m) => parseRoles(m.role).includes(role)).map((m) => m.name);
  return names.length > 0 ? names.join(" / ") : null;
}
