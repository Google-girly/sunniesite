import { NextResponse } from "next/server";
import { isIncomeAccountCode } from "@/lib/financialBooksAccounts";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("finances");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: { date?: string; description?: string; amount?: number; accountCode?: number; notes?: string } = {};
  if (typeof body.date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date.trim())) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    data.date = body.date.trim();
  }
  if (typeof body.description === "string") {
    const description = body.description.trim();
    if (!description) return NextResponse.json({ error: "Description is required." }, { status: 400 });
    data.description = description;
  }
  if (typeof body.amount === "number") {
    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ error: "Amount must be a number greater than zero." }, { status: 400 });
    }
    data.amount = body.amount;
  }
  if ("accountCode" in body) {
    if (body.accountCode === null || body.accountCode === "") {
      return NextResponse.json({ error: "A category (account code) is required." }, { status: 400 });
    }
    const code = Number(body.accountCode);
    if (!Number.isFinite(code) || !isIncomeAccountCode(code)) {
      return NextResponse.json({ error: "Unrecognized income account code." }, { status: 400 });
    }
    data.accountCode = code;
  }
  if (typeof body.notes === "string") {
    const notes = body.notes.trim();
    if (!notes) return NextResponse.json({ error: "Notes are required." }, { status: 400 });
    data.notes = notes;
  }

  try {
    const entry = await prisma.chapterFundEntry.update({ where: { id }, data });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Fund entry not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("finances");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.chapterFundEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Fund entry not found." }, { status: 404 });
  }
}
