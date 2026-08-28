import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePresidentApi } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// President setting (or resetting) another member's password — the
// bootstrap path, since there's no email delivery to send a reset link
// through. Each member can also change her own via
// /api/auth/change-password once she's logged in.
export async function POST(request: Request, { params }: RouteParams) {
  const access = await requirePresidentApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  try {
    await prisma.member.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
}

// Revoke a member's login (clear her password) without deleting her
// from the roster — e.g. someone who's no longer active but shouldn't
// be removed from chapter history.
export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requirePresidentApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.member.update({ where: { id }, data: { passwordHash: null } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
}
