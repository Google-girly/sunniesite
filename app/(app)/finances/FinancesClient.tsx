"use client";

import Link from "next/link";
import { useState } from "react";
import type { Budget, BudgetLineItem, BudgetVersion } from "@/app/generated/prisma/client";
import { BUDGET_LOG_STATUSES, calculateBudgetTotals, formatEventDate, isApprovedVersion } from "@/lib/budgets";

type VersionWithItems = BudgetVersion & { lineItems: BudgetLineItem[] };
type BudgetWithFinal = Budget & { versions: VersionWithItems[] };
type Row = { budget: BudgetWithFinal; final: VersionWithItems; totals: ReturnType<typeof calculateBudgetTotals> };

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

function StatusBadge({ status }: { status: string | null }) {
  const cls: Record<string, string> = {
    Passed: "bg-green-50 text-green-700",
    Pending: "bg-amber-50 text-amber-700",
    Failed: "bg-red-50 text-red-700",
    Tabled: "bg-stone-100 text-stone-500",
  };
  const label = status ?? "Not Set";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        cls[status ?? ""] ?? "bg-stone-100 text-stone-500"
      }`}
    >
      {label}
    </span>
  );
}

export function FinancesClient({ initialBudgets }: { initialBudgets: BudgetWithFinal[] }) {
  const [budgets, setBudgets] = useState<BudgetWithFinal[]>(initialBudgets);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  const rows: Row[] = budgets
    .map((budget) => {
      const final = budget.versions[0];
      if (!final) return null;
      const totals = calculateBudgetTotals(final.lineItems, final.salesTaxRate);
      return { budget, final, totals };
    })
    .filter((row): row is Row => row !== null);

  const noFinalCount = budgets.length - rows.length;

  const approvedRows = rows.filter((r) => isApprovedVersion(r.final));
  const queueRows = rows.filter((r) => !isApprovedVersion(r.final));

  const grandTotal = approvedRows.reduce((sum, r) => sum + r.totals.total, 0);

  async function changeStatus(row: Row, status: string) {
    setApprovingId(row.budget.id);
    setApproveError(null);
    const res = await fetch(`/api/budgets/${row.budget.id}/versions/${row.final.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setApprovingId(null);
    if (!res.ok) {
      setApproveError(await parseError(res));
      return;
    }
    const updated: BudgetVersion = await res.json();
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === row.budget.id
          ? { ...b, versions: b.versions.map((v) => (v.id === row.final.id ? { ...v, ...updated } : v)) }
          : b
      )
    );
  }

  function DisplayRow({ row, editableStatus }: { row: Row; editableStatus: boolean }) {
    const { budget, final, totals } = row;
    return (
      <tr>
        <td className="px-4 py-2.5 font-medium text-stone-900">
          <Link href={`/budgets/${budget.id}/final`} className="hover:text-burgundy-700 hover:underline">
            {budget.eventName}
          </Link>
        </td>
        <td className="px-4 py-2.5 text-stone-600">{budget.chair || "—"}</td>
        <td className="px-4 py-2.5 text-stone-600">{formatEventDate(budget.eventDate)}</td>
        <td className="px-4 py-2.5">
          {editableStatus ? (
            <select
              value={final.status ?? ""}
              onChange={(e) => changeStatus(row, e.target.value)}
              disabled={approvingId === budget.id}
              className="rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            >
              <option value="">— Not Set —</option>
              {BUDGET_LOG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <StatusBadge status={final.status} />
          )}
        </td>
        <td className="px-4 py-2.5 text-stone-600">
          {(final.salesTaxRate * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%
        </td>
        <td className="px-4 py-2.5 font-medium text-stone-900">{money(totals.total)}</td>
        <td className="px-4 py-2.5 whitespace-nowrap text-right">
          {/* Edit goes to the event's hub in Budgets & Reimbursements
              (name/chair/date live there); Open goes straight to this
              Final Budget (line items/tax/status/receipts). */}
          <Link
            href={`/budgets/${budget.id}`}
            className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
          >
            Edit
          </Link>
          <Link
            href={`/budgets/${budget.id}/final`}
            className="ml-3 text-sm font-medium text-stone-400 hover:text-stone-700"
          >
            Open
          </Link>
        </td>
      </tr>
    );
  }

  const columns = ["Event", "Chair", "Date", "Status", "Tax Rate", "Total", ""];

  return (
    <div>
      <div className="rounded-lg border border-stone-200 bg-white p-4 sm:max-w-xs">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Total Spent <span className="normal-case text-stone-400">(approved)</span>
        </p>
        <p className="mt-1 text-2xl font-semibold text-stone-900">{money(grandTotal)}</p>
      </div>

      {approveError && <p className="mt-4 text-sm text-red-600">{approveError}</p>}

      {/* Awaiting Approval queue */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-stone-900">Awaiting Approval</h2>
        <p className="mt-1 text-sm text-stone-500">
          Final Budgets sitting in limbo — not counted in the total above and not
          in the Financial Books export until Status is set to &quot;Passed&quot;
          right here in the table.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                {columns.map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {queueRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-6 text-center text-stone-400">
                    Nothing waiting on approval.
                  </td>
                </tr>
              )}
              {queueRows.map((row) => (
                <DisplayRow key={row.budget.id} row={row} editableStatus />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approved */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-stone-900">Approved</h2>
        <p className="mt-1 text-sm text-stone-500">
          These make up the total above and the Financial Books export.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                {columns.map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {approvedRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-6 text-center text-stone-400">
                    Nothing approved yet.
                  </td>
                </tr>
              )}
              {approvedRows.map((row) => (
                <DisplayRow key={row.budget.id} row={row} editableStatus={false} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {noFinalCount > 0 && (
        <p className="mt-3 text-xs text-stone-400">
          {noFinalCount} event{noFinalCount === 1 ? "" : "s"} without a Final
          Budget yet {noFinalCount === 1 ? "isn't" : "aren't"} listed above at all.
        </p>
      )}
    </div>
  );
}
