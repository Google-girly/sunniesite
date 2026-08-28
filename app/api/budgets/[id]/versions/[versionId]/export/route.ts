import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBudgetWorkbook, budgetExportFilename } from "@/lib/budgetExport";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { versionId } = await params;
  const version = await prisma.budgetVersion.findUnique({
    where: { id: versionId },
    include: { budget: true, lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  if (!version) {
    return NextResponse.json({ error: "Budget version not found." }, { status: 404 });
  }

  const bytes = await buildBudgetWorkbook(version.budget, version);
  // Re-copy into a plain, non-shared ArrayBuffer: JSZip's output type is
  // wider (ArrayBufferLike, which also covers SharedArrayBuffer) than
  // what Blob's constructor will accept.
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${budgetExportFilename(version.budget, version)}"`,
    },
  });
}
