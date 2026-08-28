import { NextResponse } from "next/server";
import { isSisterOfMonthMonth } from "@/lib/standardsForms";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

// Upsert on (year, month) — one Sister of the Month per calendar month,
// so re-submitting the same month replaces whoever was there before.
export async function POST(request: Request) {
  const access = await requireApiAccess("sisterhood");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const year = typeof body.year === "number" ? body.year : NaN;
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Year is required." }, { status: 400 });
  }
  const month = typeof body.month === "string" ? body.month : "";
  if (!isSisterOfMonthMonth(month)) {
    return NextResponse.json({ error: "Invalid month." }, { status: 400 });
  }

  const notApplicable = body.notApplicable === true;
  const memberId =
    !notApplicable && typeof body.memberId === "string" && body.memberId.trim()
      ? body.memberId.trim()
      : null;

  if (memberId) {
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const data = { notApplicable, memberId };
  const record = await prisma.sisterOfTheMonth.upsert({
    where: { year_month: { year, month } },
    create: { year, month, ...data },
    update: data,
    include: { member: true },
  });

  return NextResponse.json(record, { status: 201 });
}
