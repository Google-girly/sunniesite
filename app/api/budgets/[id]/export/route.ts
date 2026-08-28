import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildFullBudgetWorkbook, fullBudgetExportFilename } from "@/lib/budgetExport";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Exports the whole budget — one workbook with both the Tentative and
// Final sheets filled in (whichever versions actually exist). For a
// single version's own export (just Tentative, or just Final) see
// /api/budgets/[id]/versions/[versionId]/export instead.
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: { versions: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!budget) {
    return NextResponse.json({ error: "Budget not found." }, { status: 404 });
  }

  const tentative = budget.versions.find((v) => v.stage === "TENTATIVE");
  const final = budget.versions.find((v) => v.stage === "FINAL");
  if (!tentative && !final) {
    return NextResponse.json(
      { error: "This budget doesn't have a Tentative or Final version to export yet." },
      { status: 400 }
    );
  }

  const bytes = await buildFullBudgetWorkbook(budget, { tentative, final });
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fullBudgetExportFilename(budget)}"`,
    },
  });
}
