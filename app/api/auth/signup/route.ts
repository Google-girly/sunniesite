import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, buildSessionCookieValue, hashPassword } from "@/lib/auth";

// Self-service account creation (Aug 2026) — a sister claims her own
// Roster row and sets her own password, instead of needing the
// President to set an initial one for her from Manage Officers &
// Logins first. Deliberately narrow: this can only claim a Member the
// President already added to the Roster and that has no password set
// yet — it can never create a brand-new Member row, and it can never
// take over an account that's already been claimed (same "already
// exists" error either way, so this can't be used to probe which names
// on the roster have signed up yet).
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
  const memberId = typeof body?.memberId === "string" ? body.memberId : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (enteredSignupPassword !== signupPassword) {
    return NextResponse.json({ error: "That's not the chapter password. Ask an officer." }, { status: 401 });
  }
  if (!memberId) {
    return NextResponse.json({ error: "Pick your name." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member || member.passwordHash) {
    return NextResponse.json(
      { error: "That account has already been set up — log in instead, or ask the President to reset it." },
      { status: 400 }
    );
  }

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { passwordHash: hashPassword(password) },
  });

  // Same as /api/auth/login — signing up logs her straight in rather
  // than bouncing her to a separate login step right after.
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, buildSessionCookieValue(updated.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
