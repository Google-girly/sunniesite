import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function GET() {
  const access = await requireApiAccess("finances");
  if ("error" in access) return access.error;

  const balances = await prisma.chapterStartingBalance.findMany({ orderBy: { year: "desc" } });
  return NextResponse.json(balances);
}

// Upsert on `year` — setting a new balance for a year that already has
// one replaces it, same natural-key pattern used throughout this app,
// rather than accumulating duplicate rows for the same year.
export async function PUT(request: Request) {
  const access = await requireApiAccess("finances");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const year = typeof body.year === "number" && Number.isInteger(body.year) ? body.year : NaN;
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "A valid year is required." }, { status: 400 });
  }
  const amount = typeof body.amount === "number" && Number.isFinite(body.amount) ? body.amount : NaN;
  if (!Number.isFinite(amount)) {
    return NextResponse.json({ error: "A valid starting balance amount is required." }, { status: 400 });
  }
  const asOfDate = typeof body.asOfDate === "string" ? body.asOfDate.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  const balance = await prisma.chapterStartingBalance.upsert({
    where: { year },
    create: { year, amount, asOfDate, notes },
    update: { amount, asOfDate, notes },
  });
  return NextResponse.json(balance);
}
