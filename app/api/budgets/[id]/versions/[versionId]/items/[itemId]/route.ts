import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isExpenseAccountCode } from "@/lib/financialBooksAccounts";

interface RouteParams {
  params: Promise<{ id: string; versionId: string; itemId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { versionId, itemId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: {
    item?: string;
    quantity?: number;
    price?: number;
    taxable?: boolean;
    accountCode?: number;
  } = {};

  if (typeof body.item === "string") {
    const item = body.item.trim();
    if (!item) {
      return NextResponse.json({ error: "Item name is required." }, { status: 400 });
    }
    // Case-insensitive, and excluding this item itself — renaming
    // "Decorations " to "Decorations" isn't a new duplicate.
    const existing = await prisma.budgetLineItem.findMany({
      where: { versionId, NOT: { id: itemId } },
      select: { item: true },
    });
    if (existing.some((i) => i.item.trim().toLowerCase() === item.toLowerCase())) {
      return NextResponse.json(
        { error: `"${item}" is already on this budget.` },
        { status: 409 }
      );
    }
    data.item = item;
  }
  if (typeof body.quantity === "number" && Number.isFinite(body.quantity)) {
    data.quantity = body.quantity;
  }
  if (typeof body.price === "number" && Number.isFinite(body.price)) {
    data.price = body.price;
  }
  if (typeof body.taxable === "boolean") {
    data.taxable = body.taxable;
  }
  if ("accountCode" in body) {
    if (typeof body.accountCode === "number" && isExpenseAccountCode(body.accountCode)) {
      data.accountCode = body.accountCode;
    } else {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }
  }

  try {
    const lineItem = await prisma.budgetLineItem.update({ where: { id: itemId }, data });
    return NextResponse.json(lineItem);
  } catch {
    return NextResponse.json({ error: "Line item not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { itemId } = await params;
  try {
    await prisma.budgetLineItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Line item not found." }, { status: 404 });
  }
}
