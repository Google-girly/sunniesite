import { NextResponse } from "next/server";
import { findFine, isEntryType } from "@/lib/fines";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function POST(request: Request) {
  const access = await requireApiAccess("fines");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) {
    return NextResponse.json({ error: "Member is required." }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type : "";
  if (!isEntryType(type)) {
    return NextResponse.json({ error: "A valid entry type is required." }, { status: 400 });
  }

  const amount = typeof body.amount === "number" ? body.amount : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be a number greater than zero." },
      { status: 400 }
    );
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 });
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }

  let fineCode: string | null = null;
  if (typeof body.fineCode === "string" && body.fineCode.trim()) {
    if (!findFine(body.fineCode.trim())) {
      return NextResponse.json({ error: "Unrecognized fine code." }, { status: 400 });
    }
    fineCode = body.fineCode.trim();
  }

  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const entry = await prisma.accountEntry.create({
    data: { memberId, type, amount, description, date, fineCode, notes },
  });

  return NextResponse.json(entry, { status: 201 });
}
