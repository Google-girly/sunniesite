import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { isMemberStatus, serializeRoles } from "@/lib/roster";
import { OFFICER_POSITIONS } from "@/lib/positions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Self-service account creation (Aug 2026, reworked from an earlier
// "claim a Roster row the President already added" design on request —
// the President doesn't want a fixed roster to sign up against, she
// wants anyone who knows the chapter password to be able to register,
// then have an officer approve her). This creates a brand-new Member
// row — `approved` defaults `false` for anything created through this
// route (see prisma/schema.prisma), so she can't actually log in
// (app/api/auth/login checks it) until the President, Vice President,
// or VP of Communications approves her from the Pending Sign-Ups panel (see components/PendingSignupsPanel.tsx).
//
// Aug 2026: every real Roster column (Class, Line #, Name, Nickname,
// Role, Status, Crossing Term, Email) is now required here too, so an
// approved signup already IS a complete Roster row rather than needing
// an officer to backfill it afterward — same fields/validation Roster's
// own "Add Member" form uses (app/(app)/roster/RosterClient.tsx), just
// self-reported. Role is multi-select (Aug 2026, same
// components/RoleDropdown.tsx Manage Officers & Logins uses) — required
// in the sense that the field must be actively answered, satisfied by
// picking zero positions ("General member"), same as everywhere else
// role gets edited. Notes stays optional, a free-text catch-all.
//
// No session cookie is set here — unlike the old design, signing up
// doesn't log her in, since there's nothing to log her into yet.
export async function POST(request: Request) {
  const signupPassword = process.env.SIGNUP_PASSWORD;
  if (!signupPassword) {
    return NextResponse.json(
      { error: "Signup isn't configured yet — ask the President to set SIGNUP_PASSWORD." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const enteredSignupPassword = typeof body?.signupPassword === "string" ? body.signupPassword : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const memberClass = typeof body?.class === "string" ? body.class.trim() : "";
  const crossingNumberRaw = typeof body?.crossingNumber === "string" ? body.crossingNumber.trim() : "";
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  const roles: string[] = Array.isArray(body?.roles)
    ? body.roles.filter((r: unknown): r is string => typeof r === "string")
    : [];
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const crossingTerm = typeof body?.crossingTerm === "string" ? body.crossingTerm.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (enteredSignupPassword !== signupPassword) {
    return NextResponse.json({ error: "That's not the chapter password. Ask an officer." }, { status: 401 });
  }
  if (name.split(/\s+/).filter(Boolean).length < 2) {
    return NextResponse.json({ error: "Enter your first and last name." }, { status: 400 });
  }
  if (!memberClass) {
    return NextResponse.json({ error: "Class is required (e.g. ΑΒ, or Founding)." }, { status: 400 });
  }
  const crossingNumber = Number.parseInt(crossingNumberRaw, 10);
  if (!crossingNumberRaw || !Number.isInteger(crossingNumber) || crossingNumber < 0) {
    return NextResponse.json({ error: "Enter a valid Line #." }, { status: 400 });
  }
  if (!nickname) {
    return NextResponse.json({ error: "Nickname is required." }, { status: 400 });
  }
  if (roles.some((r) => !(OFFICER_POSITIONS as readonly string[]).includes(r))) {
    return NextResponse.json({ error: "Invalid Role selected." }, { status: 400 });
  }
  if (!isMemberStatus(status)) {
    return NextResponse.json({ error: "Select a valid Status." }, { status: 400 });
  }
  if (!crossingTerm) {
    return NextResponse.json({ error: "Crossing Term is required (e.g. Fall 2024)." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  // Loose on purpose — just enough digits to be a real number, no
  // opinion on formatting (dashes, parens, country code, etc.).
  if (phone.replace(/\D/g, "").length < 7) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  // A light duplicate guard, not a hard uniqueness rule — two sisters
  // could genuinely share a name someday, and if that ever happens the
  // approving officer will see both pending rows and can sort it out.
  // This just catches the much more common case: an accidental
  // double-submit of the same signup.
  const existing = await prisma.member.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Someone with that name already has an account or a pending request — log in, or ask an officer if this is a mistake." },
      { status: 400 }
    );
  }

  await prisma.member.create({
    data: {
      name,
      email,
      phone,
      class: memberClass,
      crossingNumber,
      nickname,
      role: serializeRoles(roles),
      status,
      crossingTerm,
      notes: notes || null,
      passwordHash: hashPassword(password),
      approved: false,
    },
  });

  return NextResponse.json({ ok: true, pending: true });
}
