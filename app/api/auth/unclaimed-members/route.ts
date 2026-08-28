import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public (pre-login) — the signup page's "who are you?" picker. The
// mirror image of /api/auth/members (which only lists members who
// already HAVE a password, for logging in): this lists only members the
// President has added to the Roster but who haven't claimed an account
// yet, so nobody can "sign up" as someone who already has one.
export async function GET() {
  const members = await prisma.member.findMany({
    where: { passwordHash: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(members);
}
