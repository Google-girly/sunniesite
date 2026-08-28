import { NextResponse } from "next/server";
import { isIncomeAccountCode } from "@/lib/financialBooksAccounts";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function GET() {
  const access = await requireApiAccess("finances");
  if ("error" in access) return access.error;

  const entries = await prisma.chapterFundEntry.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const access = await requireApiAccess("finances");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 });
  }
  const amount = typeof body.amount === "number" ? body.amount : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a number greater than zero." }, { status: 400 });
  }
  if (body.accountCode === undefined || body.accountCode === null || body.accountCode === "") {
    return NextResponse.json({ error: "A category (account code) is required." }, { status: 400 });
  }
  const accountCode = Number(body.accountCode);
  if (!Number.isFinite(accountCode) || !isIncomeAccountCode(accountCode)) {
    return NextResponse.json({ error: "Unrecognized income account code." }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!notes) {
    return NextResponse.json({ error: "Notes are required." }, { status: 400 });
  }

  const entry = await prisma.chapterFundEntry.create({
    data: { date, description, amount, accountCode, notes },
  });
  return NextResponse.json(entry, { status: 201 });
}
