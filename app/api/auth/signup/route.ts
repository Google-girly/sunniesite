import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Self-service account creation (Aug 2026, reworked from an earlier
// "claim a Roster row the President already added" design on request —
// the President doesn't want a fixed roster to sign up against, she
// wants anyone who knows the chapter password to be able to register,
// then have an officer approve her). This creates a brand-new Member
// row — status defaults to "ACTIVE", no position — but `approved`
// defaults `false` for anything created through this route (see
// prisma/schema.prisma), so she can't actually log in
// (app/api/auth/login checks it) until the President, Vice President,
// or VP of Communications approves her from /pending-signups.
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

  if (enteredSignupPassword !== signupPassword) {
    return NextResponse.json({ error: "That's not the chapter password. Ask an officer." }, { status: 401 });
  }
  if (!name) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
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
      passwordHash: hashPassword(password),
      approved: false,
    },
  });

  return NextResponse.json({ ok: true, pending: true });
}
