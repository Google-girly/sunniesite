import { NextResponse } from "next/server";
import { findFine, isEntryType } from "@/lib/fines";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("fines");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: {
    type?: string;
    amount?: number;
    description?: string;
    date?: string;
    fineCode?: string | null;
    notes?: string | null;
  } = {};

  if (typeof body.type === "string") {
    if (!isEntryType(body.type)) {
      return NextResponse.json({ error: "A valid entry type is required." }, { status: 400 });
    }
    data.type = body.type;
  }
  if (typeof body.amount === "number") {
    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a number greater than zero." },
        { status: 400 }
      );
    }
    data.amount = body.amount;
  }
  if (typeof body.description === "string") {
    const description = body.description.trim();
    if (!description) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }
    data.description = description;
  }
  if (typeof body.date === "string") {
    const date = body.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    data.date = date;
  }
  if ("fineCode" in body) {
    if (typeof body.fineCode === "string" && body.fineCode.trim()) {
      if (!findFine(body.fineCode.trim())) {
        return NextResponse.json({ error: "Unrecognized fine code." }, { status: 400 });
      }
      data.fineCode = body.fineCode.trim();
    } else {
      data.fineCode = null;
    }
  }
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;

  try {
    const entry = await prisma.accountEntry.update({ where: { id }, data });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("fines");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.accountEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
}
