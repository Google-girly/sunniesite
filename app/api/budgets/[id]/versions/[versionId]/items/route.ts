import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isExpenseAccountCode } from "@/lib/financialBooksAccounts";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { versionId } = await params;
  const body = await request.json().catch(() => null);
  const item = typeof body?.item === "string" ? body.item.trim() : "";

  if (!item) {
    return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  }

  const quantity =
    typeof body?.quantity === "number" && Number.isFinite(body.quantity)
      ? body.quantity
      : 1;
  const price =
    typeof body?.price === "number" && Number.isFinite(body.price) ? body.price : 0;
  const taxable = body?.taxable === true;
  const accountCode =
    typeof body?.accountCode === "number" && isExpenseAccountCode(body.accountCode)
      ? body.accountCode
      : null;

  if (accountCode === null) {
    return NextResponse.json({ error: "Category is required." }, { status: 400 });
  }

  // Case-insensitive: "Decorations" and "decorations" are the same
  // expense, not two different ones.
  const existing = await prisma.budgetLineItem.findMany({
    where: { versionId },
    select: { item: true },
  });
  if (existing.some((i) => i.item.trim().toLowerCase() === item.toLowerCase())) {
    return NextResponse.json(
      { error: `"${item}" is already on this budget.` },
      { status: 409 }
    );
  }

  try {
    const count = await prisma.budgetLineItem.count({ where: { versionId } });
    const lineItem = await prisma.budgetLineItem.create({
      data: { versionId, item, quantity, price, taxable, accountCode, sortOrder: count },
    });
    return NextResponse.json(lineItem, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Budget version not found." }, { status: 404 });
  }
}
