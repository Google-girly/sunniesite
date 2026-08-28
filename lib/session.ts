// Who's actually logged in right now, as a real Member (not just "some
// valid session exists" — that's all proxy.ts checks, since it can't
// hit the database from the edge). Every Server Component page and API
// route that needs to know "who is this" or gate by position
// (lib/permissions.ts) goes through here.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Member } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { readSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { canAccessModule, canApproveSignups, isPresident, ownsModule, type ModuleKey } from "@/lib/permissions";

/** The logged-in Member, or null if not logged in (or her account was since deleted). */
export async function getCurrentMember(): Promise<Member | null> {
  const cookieStore = await cookies();
  const memberId = readSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!memberId) return null;
  return prisma.member.findUnique({ where: { id: memberId } });
}

export interface PageAccess {
  member: Member;
  allowed: boolean;
}

// For a Server Component page: `proxy.ts` already guarantees a valid
// session cookie exists, but not that the member behind it still exists
// (deleted account, stale cookie) — redirect to /login in that edge
// case too, same as never having logged in. Otherwise returns the real
// member plus whether this specific module lets her in; the page
// renders <NotAuthorized/> (components/NotAuthorized.tsx) when
// `allowed` is false rather than this helper redirecting past it, so
// there's always a clear "here's why" instead of a confusing bounce.
export async function requirePageAccess(moduleKey: ModuleKey): Promise<PageAccess> {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return { member, allowed: canAccessModule(member, moduleKey) };
}

// Same idea for API routes, which can't redirect — callers do:
//   const access = await requireApiAccess("finances");
//   if ("error" in access) return access.error;
//   const { member } = access;
export async function requireApiAccess(
  moduleKey: ModuleKey
): Promise<{ member: Member } | { error: NextResponse }> {
  const member = await getCurrentMember();
  if (!member) {
    return { error: NextResponse.json({ error: "Not logged in." }, { status: 401 }) };
  }
  if (!canAccessModule(member, moduleKey)) {
    return {
      error: NextResponse.json(
        { error: "You don't have access to this — ask the officer who does, or the President." },
        { status: 403 }
      ),
    };
  }
  return { member };
}

// For a self-service module's "everyone's data" actions — the export
// that dumps every member's log, seeing someone else's individual page,
// etc. Distinct from requireApiAccess: that gates the whole module
// (false for a general member on a self-service module would be wrong,
// since she's allowed in for HER OWN data); this gates the
// "all members" escalation specifically.
export async function requireModuleOwnerApi(
  moduleKey: ModuleKey
): Promise<{ member: Member } | { error: NextResponse }> {
  const member = await getCurrentMember();
  if (!member) {
    return { error: NextResponse.json({ error: "Not logged in." }, { status: 401 }) };
  }
  if (!ownsModule(member, moduleKey)) {
    return {
      error: NextResponse.json(
        { error: "Only the officer who manages this (or the President) can do this." },
        { status: 403 }
      ),
    };
  }
  return { member };
}

// Manage Officers & Logins (assigning positions, setting passwords) —
// President-only, and not tied to any one Chapter Standards module, so
// it doesn't go through lib/permissions.ts's MODULE_ACCESS table.
export interface PresidentPageAccess {
  member: Member;
  allowed: boolean;
}

export async function requirePresidentPage(): Promise<PresidentPageAccess> {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return { member, allowed: isPresident(member) };
}

export async function requirePresidentApi(): Promise<{ member: Member } | { error: NextResponse }> {
  const member = await getCurrentMember();
  if (!member) {
    return { error: NextResponse.json({ error: "Not logged in." }, { status: 401 }) };
  }
  if (!isPresident(member)) {
    return {
      error: NextResponse.json({ error: "Only the President can do this." }, { status: 403 }),
    };
  }
  return { member };
}

// Pending Sign-Ups (approving/denying a self-registered Member) —
// President, Vice President, or Vice President of Communications, per
// lib/permissions.ts canApproveSignups(). Not President-only like the
// rest of Manage Officers & Logins, so it's its own page/gate rather
// than folded into requirePresidentPage above.
export interface ApproverPageAccess {
  member: Member;
  allowed: boolean;
}

export async function requireApproverPage(): Promise<ApproverPageAccess> {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return { member, allowed: canApproveSignups(member) };
}

export async function requireApproverApi(): Promise<{ member: Member } | { error: NextResponse }> {
  const member = await getCurrentMember();
  if (!member) {
    return { error: NextResponse.json({ error: "Not logged in." }, { status: 401 }) };
  }
  if (!canApproveSignups(member)) {
    return {
      error: NextResponse.json(
        { error: "Only the President, Vice President, or VP of Communications can do this." },
        { status: 403 }
      ),
    };
  }
  return { member };
}
