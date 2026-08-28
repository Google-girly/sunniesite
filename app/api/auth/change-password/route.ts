import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";

// Any logged-in member changing her own password — distinct from
// /api/officers/[id]/password, which is the President setting someone
// ELSE's (no current-password check needed there, since it's the
// bootstrap/reset path, not a self-service one).
export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!verifyPassword(currentPassword, member.passwordHash)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
  }

  await prisma.member.update({ where: { id: member.id }, data: { passwordHash: hashPassword(newPassword) } });
  return NextResponse.json({ ok: true });
}
