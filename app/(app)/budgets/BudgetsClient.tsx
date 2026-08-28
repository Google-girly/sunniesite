"use client";

import Link from "next/link";
import { useState } from "react";
import type { Budget, BudgetLineItem, BudgetVersion } from "@/app/generated/prisma/client";
import {
  BUDGET_STAGE_LABELS,
  type BudgetStage,
  calculateBudgetTotals,
  formatEventDate,
} from "@/lib/budgets";
import { OFFICER_POSITIONS } from "@/lib/positions";
import { confirmDelete } from "@/lib/confirmDelete";

type VersionWithItems = BudgetVersion & { lineItems: BudgetLineItem[] };
type BudgetWithVersions = Budget & { versions: VersionWithItems[] };

interface FormValues {
  eventName: string;
  chair: string;
  eventDate: string;
}

const EMPTY_FORM: FormValues = { eventName: "", chair: "", eventDate: "" };

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

function VersionBadge({ budget, stage }: { budget: BudgetWithVersions; stage: BudgetStage }) {
  const version = budget.versions.find((v) => v.stage === stage);
  if (!version) {
    return (
      <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-400">
        No {BUDGET_STAGE_LABELS[stage]}
      </span>
    );
  }
  const { total } = calculateBudgetTotals(version.lineItems, version.salesTaxRate);
  return (
    <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      {BUDGET_STAGE_LABELS[stage]}: {money(total)}
    </span>
  );
}

export function BudgetsClient({ initialBudgets }: { initialBudgets: BudgetWithVersions[] }) {
  const [budgets, setBudgets] = useState<BudgetWithVersions[]>(initialBudgets);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.eventName.trim()) {
      setError("Event name is required.");
      return;
    }
    if (!form.chair.trim()) {
      setError("Chair is required.");
      return;
    }
    if (!form.eventDate.trim()) {
      setError("Date of Event is required.");
      return;
    }
    setAdding(true);
    setError(null);

    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setAdding(false);

    if (!res.ok) {
      setError(await parseError(res));
      return;
    }

    const created: BudgetWithVersions = await res.json();
    setBudgets((prev) => [created, ...prev]);
    setForm(EMPTY_FORM);
    setShowAddForm(false);
  }

  async function handleDelete(budget: BudgetWithVersions) {
    if (
      !confirmDelete(
        `Delete the budget for "${budget.eventName}"? This removes its Tentative and Final versions too, and can't be undone.`
      )
    )
      return;
    setDeletingId(budget.id);
    const res = await fetch(`/api/budgets/${budget.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setBudgets((prev) => prev.filter((b) => b.id !== budget.id));
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {budgets.length} budget{budgets.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => {
            setShowAddForm((prev) => !prev);
            setError(null);
          }}
          className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          {showAddForm ? "Cancel" : "New Budget"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Event Name <span className="text-rose-500">*</span>
            </label>
            <input
              value={form.eventName}
              onChange={(e) => setForm({ ...form, eventName: e.target.value })}
              autoFocus
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Chair <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.chair}
              onChange={(e) => setForm({ ...form, chair: e.target.value })}
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            >
              <option value="">— Select —</option>
              {OFFICER_POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Date of Event <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={adding}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {adding ? "Creating..." : "Create budget"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["#", "Event", "Chair", "Date", "Versions", ""].map((h) => (
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
            {budgets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  No budgets yet. Create the first one above.
                </td>
              </tr>
            )}

            {budgets.map((budget) => (
              <tr key={budget.id}>
                <td className="px-4 py-2.5 text-stone-400">
                  {budget.budgetNumber ? `#${budget.budgetNumber}` : "—"}
                </td>
                <td className="px-4 py-2.5 font-medium text-stone-900">
                  <Link
                    href={`/budgets/${budget.id}`}
                    className="hover:text-rose-700 hover:underline"
                  >
                    {budget.eventName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-stone-600">{budget.chair || "—"}</td>
                <td className="px-4 py-2.5 text-stone-600">{formatEventDate(budget.eventDate)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <VersionBadge budget={budget} stage="TENTATIVE" />
                    <VersionBadge budget={budget} stage="FINAL" />
                  </div>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <Link
                    href={`/budgets/${budget.id}`}
                    className="text-sm font-medium text-rose-600 hover:text-rose-800"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => handleDelete(budget)}
                    disabled={deletingId === budget.id}
                    className="ml-3 text-sm font-medium text-stone-400 hover:text-red-600 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
