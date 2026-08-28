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

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) {
    return NextResponse.json({ error: "Member is required." }, { status: 400 });
  }
  const term = typeof body.term === "string" ? body.term.trim() : "";
  if (!term) {
    return NextResponse.json({ error: "Term is required." }, { status: 400 });
  }
  const cumGpa = typeof body.cumGpa === "number" ? body.cumGpa : NaN;
  if (!Number.isFinite(cumGpa)) {
    return NextResponse.json({ error: "A numeric cumulative GPA is required." }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const isPlaqueRecipient = body.isPlaqueRecipient === true;
  if (isPlaqueRecipient) {
    // Only one plaque recipient per year makes sense — clear any other
    // flag set for the same term rather than leaving two contradictory
    // rows on file.
    await prisma.alphaOrderRecord.updateMany({
      where: { term, isPlaqueRecipient: true },
      data: { isPlaqueRecipient: false },
    });
  }

  const scholarshipAmount = parseScholarship(body.scholarshipAmount);

  const record = await prisma.alphaOrderRecord.create({
    data: {
      memberId,
      term,
      cumGpa,
      major: typeof body.major === "string" && body.major.trim() ? body.major.trim() : null,
      isPlaqueRecipient,
      scholarshipAmount,
    },
  });

  return NextResponse.json(record, { status: 201 });
}

function parseScholarship(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}
