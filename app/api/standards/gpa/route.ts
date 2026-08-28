import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

function parseNullableNumber(value: unknown): number | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "number") return undefined;
  return Number.isFinite(value) ? value : undefined;
}

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

  const termGpa = parseNullableNumber(body.termGpa);
  const cumGpa = parseNullableNumber(body.cumGpa);
  if (termGpa === undefined || cumGpa === undefined) {
    return NextResponse.json({ error: "GPA values must be numbers." }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const record = await prisma.gpaRecord.create({
    data: {
      memberId,
      term,
      termGpa,
      cumGpa,
      status: typeof body.status === "string" && body.status.trim() ? body.status.trim() : null,
      major: typeof body.major === "string" && body.major.trim() ? body.major.trim() : null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
