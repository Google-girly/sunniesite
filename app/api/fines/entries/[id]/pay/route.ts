import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Account code 102 "Fines" — see lib/financialBooksAccounts.ts INCOME_ACCOUNTS.
const FINES_ACCOUNT_CODE = 102;

// Clears a fine as *paid*: marks it paid on the member's account (so it
// stops counting toward her balance) and logs the same amount as a
// deposit into the chapter account, both in one transaction so the two
// never drift apart. Clearing a fine as *removed* is just the normal
// DELETE on ../route.ts — no money moves.
export async function POST(request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("fines");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }

  const entry = await prisma.accountEntry.findUnique({ where: { id }, include: { member: true } });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  if (entry.type !== "FINE") {
    return NextResponse.json({ error: "Only fines can be cleared as paid." }, { status: 400 });
  }
  if (entry.paidAt) {
    return NextResponse.json({ error: "This fine is already marked paid." }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.accountEntry.update({ where: { id }, data: { paidAt: date } }),
    prisma.chapterFundEntry.create({
      data: {
        date,
        description: `Fine paid — ${entry.member.name}`,
        amount: entry.amount,
        accountCode: FINES_ACCOUNT_CODE,
        notes: entry.description,
      },
    }),
  ]);

  return NextResponse.json(updated);
}
