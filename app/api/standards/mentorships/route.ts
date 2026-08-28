import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function POST(request: Request) {
  const access = await requireApiAccess("academics");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const term = typeof body.term === "string" ? body.term.trim() : "";
  if (!term) {
    return NextResponse.json({ error: "Term is required." }, { status: 400 });
  }
  const menteeId = typeof body.menteeId === "string" ? body.menteeId.trim() : "";
  const mentorId = typeof body.mentorId === "string" ? body.mentorId.trim() : "";
  if (!menteeId || !mentorId) {
    return NextResponse.json({ error: "Mentee and mentor are both required." }, { status: 400 });
  }
  if (menteeId === mentorId) {
    return NextResponse.json({ error: "Mentee and mentor must be different members." }, { status: 400 });
  }

  const [mentee, mentor] = await Promise.all([
    prisma.member.findUnique({ where: { id: menteeId } }),
    prisma.member.findUnique({ where: { id: mentorId } }),
  ]);
  if (!mentee || !mentor) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const record = await prisma.mentorship.create({
    data: { term, menteeId, mentorId },
    include: { mentee: true, mentor: true },
  });

  return NextResponse.json(record, { status: 201 });
}
