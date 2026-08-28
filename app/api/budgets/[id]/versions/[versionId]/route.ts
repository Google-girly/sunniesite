import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RECEIPT_SELECT } from "@/lib/receipts";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { versionId } = await params;
  const version = await prisma.budgetVersion.findUnique({
    where: { id: versionId },
    include: {
      budget: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      receipts: { select: RECEIPT_SELECT, orderBy: { uploadedAt: "asc" } },
    },
  });
  if (!version) {
    return NextResponse.json({ error: "Budget version not found." }, { status: 404 });
  }
  return NextResponse.json(version);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { versionId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: Record<string, string | number | null> = {};

  const stringField = (key: string) => {
    if (typeof body[key] === "string") data[key] = body[key].trim() || null;
  };
  const numberField = (key: string) => {
    if (typeof body[key] === "number" && Number.isFinite(body[key])) data[key] = body[key];
  };

  stringField("notes");
  stringField("dateDue");
  stringField("motion");
  stringField("second");
  stringField("vote");
  stringField("checkNumber");
  stringField("dateReceived");
  stringField("submittedBy");
  stringField("dateSubmitted");
  stringField("datePresented");
  stringField("status");
  stringField("reimbursementMethod");
  numberField("salesTaxRate");
  numberField("checkAmount");

  // Approving (Status -> "Passed") is the one thing gated on more than
  // just "is this field filled in" — a budget can't be marked Passed
  // with no line items on it. Checked here rather than per-UI-callsite
  // (the Treasurer form, the quick Approve button on /finances, and its
  // full edit form all set status this same way) so there's exactly one
  // place this rule lives.
  //
  // Requiring at least one receipt too was asked for, but deliberately
  // NOT enabled yet (still being tested) — add a receipts.length check
  // right here, same shape, once that's ready to turn on.
  if (data.status === "Passed") {
    // Open-submit lets anyone build/edit a budget, but approving it
    // (the thing that makes it count toward Chapter Finances/Financial
    // Books) is the Treasurer's call — see lib/permissions.ts.
    if (!ownsModule(viewer, "budgets")) {
      return NextResponse.json(
        { error: "Only the Treasurer (or President) can mark a budget Passed." },
        { status: 403 }
      );
    }
    const count = await prisma.budgetLineItem.count({ where: { versionId } });
    if (count === 0) {
      return NextResponse.json(
        { error: "Add at least one line item before marking this Passed." },
        { status: 400 }
      );
    }
  }

  try {
    const version = await prisma.budgetVersion.update({
      where: { id: versionId },
      data,
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        receipts: { select: RECEIPT_SELECT, orderBy: { uploadedAt: "asc" } },
      },
    });
    return NextResponse.json(version);
  } catch {
    return NextResponse.json({ error: "Budget version not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { versionId } = await params;
  try {
    await prisma.budgetVersion.delete({ where: { id: versionId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Budget version not found." }, { status: 404 });
  }
}
