"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Budget, BudgetLineItem, BudgetVersion } from "@/app/generated/prisma/client";
import {
  BUDGET_STAGES,
  BUDGET_STAGE_LABELS,
  type BudgetStage,
  calculateBudgetTotals,
  isApprovedVersion,
} from "@/lib/budgets";
import { OFFICER_POSITIONS } from "@/lib/positions";
import { confirmDelete } from "@/lib/confirmDelete";

type VersionWithItems = BudgetVersion & { lineItems: BudgetLineItem[] };
type BudgetWithVersions = Budget & { versions: VersionWithItems[] };

interface HeaderForm {
  eventName: string;
  chair: string;
  eventDate: string;
}

function headerFormFromBudget(budget: Budget): HeaderForm {
  return {
    eventName: budget.eventName,
    chair: budget.chair ?? "",
    eventDate: budget.eventDate ?? "",
  };
}

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

function VersionCard({
  budgetId,
  stage,
  version,
  onCreated,
}: {
  budgetId: string;
  stage: BudgetStage;
  version: VersionWithItems | undefined;
  onCreated: (version: VersionWithItems) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/budgets/${budgetId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    setCreating(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    onCreated(await res.json());
  }

  if (!version) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center">
        <p className="text-sm font-medium text-stone-700">
          {BUDGET_STAGE_LABELS[stage]} Budget
        </p>
        <p className="mt-1 text-sm text-stone-400">Not started yet.</p>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {creating ? "Creating..." : `Create ${BUDGET_STAGE_LABELS[stage]} Budget`}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const { total } = calculateBudgetTotals(version.lineItems, version.salesTaxRate);

  return (
    <Link
      href={`/budgets/${budgetId}/${stage.toLowerCase()}`}
      className="block rounded-lg border border-stone-200 bg-white p-6 transition-colors hover:border-rose-300 hover:shadow-sm"
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-stone-900">
          {BUDGET_STAGE_LABELS[stage]} Budget
        </p>
        {stage === "FINAL" &&
          (isApprovedVersion(version) ? (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              Approved
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Awaiting Approval
            </span>
          ))}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {version.lineItems.length} line item{version.lineItems.length === 1 ? "" : "s"}
      </p>
      <p className="mt-3 text-lg font-semibold text-rose-700">{money(total)}</p>
      <p className="mt-1 text-xs text-stone-400">total</p>
    </Link>
  );
}

export function BudgetOverviewClient({ initialBudget }: { initialBudget: BudgetWithVersions }) {
  const router = useRouter();
  const [budget, setBudget] = useState<BudgetWithVersions>(initialBudget);
  const [headerForm, setHeaderForm] = useState<HeaderForm>(headerFormFromBudget(initialBudget));
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerSaved, setHeaderSaved] = useState(false);
  const [deletingBudget, setDeletingBudget] = useState(false);

  async function handleSaveHeader(e: React.FormEvent) {
    e.preventDefault();
    if (!headerForm.eventName.trim()) {
      setHeaderError("Event name is required.");
      return;
    }
    if (!headerForm.chair.trim()) {
      setHeaderError("Chair is required.");
      return;
    }
    if (!headerForm.eventDate.trim()) {
      setHeaderError("Date of Event is required.");
      return;
    }
    setSavingHeader(true);
    setHeaderError(null);
    setHeaderSaved(false);

    const res = await fetch(`/api/budgets/${budget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(headerForm),
    });

    setSavingHeader(false);

    if (!res.ok) {
      setHeaderError(await parseError(res));
      return;
    }

    const updated: BudgetWithVersions = await res.json();
    setBudget(updated);
    setHeaderSaved(true);
    router.refresh();
  }

  function handleVersionCreated(version: VersionWithItems) {
    setBudget((prev) => ({ ...prev, versions: [...prev.versions, version] }));
    router.refresh();
  }

  async function handleDeleteBudget() {
    if (
      !confirmDelete(
        `Delete the budget for "${budget.eventName}"? This removes its Tentative and Final versions too, and can't be undone.`
      )
    )
      return;
    setDeletingBudget(true);
    const res = await fetch(`/api/budgets/${budget.id}`, { method: "DELETE" });
    setDeletingBudget(false);
    if (res.ok) {
      router.push("/budgets");
      router.refresh();
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div>
      <Link href="/budgets" className="text-sm text-stone-500 hover:text-rose-700">
        ← Back to Budgets
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-stone-900">{budget.eventName}</h1>
          {budget.budgetNumber && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
              Budget #{budget.budgetNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {budget.versions.length > 0 && (
            <a
              href={`/api/budgets/${budget.id}/export`}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Export Whole Budget
            </a>
          )}
          <button
            onClick={handleDeleteBudget}
            disabled={deletingBudget}
            className="text-sm font-medium text-stone-400 hover:text-red-600 disabled:opacity-50"
          >
            {deletingBudget ? "Deleting..." : "Delete budget"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-stone-400">
        &quot;Export Whole Budget&quot; downloads one workbook with both the
        Tentative and Final sheets filled in (whichever exist). Each
        version below also has its own single-sheet export on its own
        page.
      </p>

      <form
        onSubmit={handleSaveHeader}
        className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div>
          <label className="block text-xs font-medium text-stone-600">
            Event Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={headerForm.eventName}
            onChange={(e) => {
              setHeaderForm({ ...headerForm, eventName: e.target.value });
              setHeaderSaved(false);
            }}
            required
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600">
            Chair <span className="text-rose-500">*</span>
          </label>
          <select
            value={headerForm.chair}
            onChange={(e) => {
              setHeaderForm({ ...headerForm, chair: e.target.value });
              setHeaderSaved(false);
            }}
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
            value={headerForm.eventDate}
            onChange={(e) => {
              setHeaderForm({ ...headerForm, eventDate: e.target.value });
              setHeaderSaved(false);
            }}
            required
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={savingHeader}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {savingHeader ? "Saving..." : "Save details"}
          </button>
          {headerError && <p className="text-sm text-red-600">{headerError}</p>}
          {headerSaved && !headerError && <p className="text-sm text-green-600">Saved.</p>}
        </div>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {BUDGET_STAGES.map((stage) => (
          <VersionCard
            key={stage}
            budgetId={budget.id}
            stage={stage}
            version={budget.versions.find((v) => v.stage === stage)}
            onCreated={handleVersionCreated}
          />
        ))}
      </div>
    </div>
  );
}
