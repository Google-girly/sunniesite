import { NextResponse } from "next/server";
import { incomeAccountLabel } from "@/lib/financialBooksAccounts";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

// Every Add Funds entry as a plain CSV, newest first — for the Treasurer
// to open in Sheets/Excel or hand off without the full Financial Books
// workbook.
function csvCell(value: string | number): string {
  const text = String(value);
  // Leading =, +, -, @ would be read as a formula by spreadsheet apps.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET() {
  const access = await requireApiAccess("finances");
  if ("error" in access) return access.error;

  const entries = await prisma.chapterFundEntry.findMany({ orderBy: { date: "desc" } });

  const rows: (string | number)[][] = [
    ["Date", "Description", "Amount", "Account Code", "Account"],
    ...entries.map((e) => [
      e.date,
      e.description,
      e.amount.toFixed(2),
      e.accountCode,
      incomeAccountLabel(e.accountCode) ?? "",
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="chapter-funds-added-${today}.csv"`,
    },
  });
}
