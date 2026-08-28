import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public (pre-login) — the login page's "who are you?" picker. Only
// id/name, and only members the President has actually set a password
// for (no dead-end options in the dropdown for someone who can't log in
// yet anyway).
export async function GET() {
  const members = await prisma.member.findMany({
    where: { passwordHash: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(members);
}
