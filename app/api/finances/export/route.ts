import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApprovedVersion } from "@/lib/budgets";
import { buildFinancialBooksWorkbook, financialBooksExportFilename } from "@/lib/financialBooksExport";
import { requireApiAccess } from "@/lib/session";

// Regenerates the "Budget Log" sheet of the chapter's real Financial
// Books workbook from every *approved* Final Budget currently in the
// app — see lib/financialBooksExport.ts for how that stays safe to
// click repeatedly (always the same template, always the same
// deterministic rows for the same data, never a duplicate row). A Final
// Budget that hasn't been approved (Status isn't "Passed" yet, see
// isApprovedVersion in lib/budgets.ts) is left out entirely — it's still
// "in limbo" and will start showing up here automatically the moment
// someone approves it, no separate action needed.
export async function GET() {
  const access = await requireApiAccess("finances");
  if ("error" in access) return access.error;

  const [budgets, fundEntries, startingBalances] = await Promise.all([
    prisma.budget.findMany({
      include: {
        versions: {
          where: { stage: "FINAL" },
          include: { lineItems: true },
        },
      },
    }),
    prisma.chapterFundEntry.findMany(),
    prisma.chapterStartingBalance.findMany({ orderBy: { year: "desc" } }),
  ]);

  const entries = budgets
    .filter((b) => b.versions.length > 0 && isApprovedVersion(b.versions[0]))
    .map((b) => ({ budget: b, version: b.versions[0] }));

  // Most recent year's starting balance is Checkbook!H9's anchor — only
  // one really applies to "the current running balance."
  const startingBalance = startingBalances[0] ?? null;

  const bytes = await buildFinancialBooksWorkbook(entries, fundEntries, startingBalance);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${financialBooksExportFilename()}"`,
    },
  });
}
