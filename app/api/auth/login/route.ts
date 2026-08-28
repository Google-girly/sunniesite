import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, buildSessionCookieValue, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const memberId = typeof body?.memberId === "string" ? body.memberId : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!memberId || !password) {
    return NextResponse.json({ error: "Pick your name and enter your password." }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  // Same error either way — don't reveal whether a member has no
  // password set yet vs. a wrong password was typed.
  if (!member || !verifyPassword(password, member.passwordHash)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, buildSessionCookieValue(member.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
