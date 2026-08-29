"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Budget, BudgetLineItem, BudgetVersion, Receipt } from "@/app/generated/prisma/client";
import {
  BUDGET_LOG_STATUSES,
  BUDGET_STAGE_LABELS,
  type BudgetStage,
  calculateBudgetTotals,
  isApprovedVersion,
  isPendingApproval,
  REIMBURSEMENT_METHODS,
} from "@/lib/budgets";
import { EXPENSE_ACCOUNTS } from "@/lib/financialBooksAccounts";
import { todayIso } from "@/lib/meetings";
import { formatFileSize } from "@/lib/receipts";
import { confirmDelete } from "@/lib/confirmDelete";

// Receipts always arrive without their file bytes (`data`) — those are
// only ever fetched on demand, one at a time, via GET
// .../receipts/[receiptId]. See lib/receipts.ts RECEIPT_SELECT.
type ReceiptSummary = Pick<Receipt, "id" | "filename" | "mimeType" | "size" | "uploadedAt">;
type VersionWithItems = BudgetVersion & { lineItems: BudgetLineItem[]; receipts: ReceiptSummary[] };

interface DetailsForm {
  salesTaxRatePercent: string; // entered as a percent, e.g. "8.25"
  notes: string;
}

interface TreasurerForm {
  submittedBy: string;
  dateDue: string;
  dateSubmitted: string;
  datePresented: string;
  motion: string;
  second: string;
  vote: string;
  status: string;
  checkNumber: string;
  checkAmount: string;
  dateReceived: string;
  reimbursementMethod: string;
}

interface ItemForm {
  item: string;
  quantity: string;
  price: string;
  taxable: boolean;
  accountCode: string; // "" = uncategorized, else one of EXPENSE_ACCOUNTS' codes as a string
}

const EMPTY_ITEM_FORM: ItemForm = {
  item: "",
  quantity: "1",
  price: "0",
  taxable: false,
  accountCode: "",
};

function accountLabel(code: number): string {
  const account = EXPENSE_ACCOUNTS.find((a) => a.code === code);
  return account ? `${account.code} — ${account.label}` : String(code);
}

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function detailsFormFromVersion(version: BudgetVersion): DetailsForm {
  return {
    salesTaxRatePercent: String(version.salesTaxRate * 100),
    notes: version.notes ?? "",
  };
}


// Submitted By defaults to whoever holds the Chair position on the
// Roster (chairHolderName, resolved server-side — see final/page.tsx),
// Date Submitted defaults to today (that's "the day they're
// submitting"), and Date Due/Date Presented both default to the next
// scheduled meeting (nextMeetingIso, also resolved server-side — see
// lib/meetings.ts) since chapter policy is that a budget is due before,
// and presented at, that meeting. On a Final Budget, Check # also
// defaults to the event's Budget Number (how the chapter cross-
// references a reimbursement check back to the budget it paid out) and
// Check Amount defaults to the Final Budget's computed total — that's
// what the check should be cut for. All of these are just starting
// values, snapshotted once when the page loads (so if line items change
// afterward, Check Amount won't silently follow along — worth a glance
// before saving) — nothing is saved until the Treasurer form itself is
// submitted, and every one can still be typed over first.
function treasurerFormFromVersion(
  version: VersionWithItems,
  chairHolderName: string | null,
  nextMeetingIso: string | null,
  stage: BudgetStage,
  budgetNumber: string | null
): TreasurerForm {
  const finalTotal =
    stage === "FINAL"
      ? Math.round(calculateBudgetTotals(version.lineItems, version.salesTaxRate).total * 100) / 100
      : null;

  return {
    submittedBy: version.submittedBy ?? chairHolderName ?? "",
    dateDue: version.dateDue ?? nextMeetingIso ?? "",
    dateSubmitted: version.dateSubmitted ?? todayIso(),
    datePresented: version.datePresented ?? nextMeetingIso ?? "",
    motion: version.motion ?? "",
    second: version.second ?? "",
    vote: version.vote ?? "",
    status: version.status ?? "",
    checkNumber: version.checkNumber ?? (stage === "FINAL" ? budgetNumber ?? "" : ""),
    checkAmount:
      version.checkAmount != null
        ? String(version.checkAmount)
        : finalTotal != null
          ? String(finalTotal)
          : "",
    dateReceived: version.dateReceived ?? "",
    reimbursementMethod: version.reimbursementMethod ?? "",
  };
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

export function VersionDetailClient({
  budget,
  initialVersion,
  stage,
  importSource,
  chairHolderName = null,
  nextMeetingIso = null,
}: {
  budget: Budget;
  initialVersion: VersionWithItems;
  stage: BudgetStage;
  // The Tentative Budget's own line items, offered as a checklist to
  // pull from here — only passed in on the Final Budget page. Absent
  // (undefined) on Tentative's own page, and null if there's no
  // Tentative Budget for this event yet.
  importSource?: VersionWithItems | null;
  // Whoever holds the Chair position on the Roster right now — used to
  // suggest a starting value for Submitted By. Null if the position is
  // vacant or Chair isn't set.
  chairHolderName?: string | null;
  // The next scheduled meeting's date (see lib/meetings.ts), used to
  // suggest Date Due/Date Presented. Null if no meeting schedule exists.
  nextMeetingIso?: string | null;
}) {
  const router = useRouter();
  const [version, setVersion] = useState<VersionWithItems>(initialVersion);
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>(initialVersion.lineItems);

  const [receipts, setReceipts] = useState<ReceiptSummary[]>(initialVersion.receipts);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);

  const [detailsForm, setDetailsForm] = useState<DetailsForm>(
    detailsFormFromVersion(initialVersion)
  );
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [treasurerForm, setTreasurerForm] = useState<TreasurerForm>(
    treasurerFormFromVersion(initialVersion, chairHolderName, nextMeetingIso, stage, budget.budgetNumber)
  );
  const [savingTreasurer, setSavingTreasurer] = useState(false);
  const [treasurerSaved, setTreasurerSaved] = useState(false);

  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemForm, setAddItemForm] = useState<ItemForm>(EMPTY_ITEM_FORM);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<ItemForm>(EMPTY_ITEM_FORM);
  const [savingItem, setSavingItem] = useState(false);
  const [editItemError, setEditItemError] = useState<string | null>(null);

  const [deletingVersion, setDeletingVersion] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const salesTaxRate = (parseFloat(detailsForm.salesTaxRatePercent) || 0) / 100;
  const totals = calculateBudgetTotals(lineItems, salesTaxRate);

  const apiBase = `/api/budgets/${budget.id}/versions/${version.id}`;

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!detailsForm.salesTaxRatePercent.trim()) {
      setDetailsError("Sales Tax % is required.");
      return;
    }
    setDetailsError(null);
    setSavingDetails(true);
    setDetailsSaved(false);

    const res = await fetch(apiBase, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salesTaxRate, notes: detailsForm.notes }),
    });

    setSavingDetails(false);

    if (res.ok) {
      const updated: VersionWithItems = await res.json();
      setVersion(updated);
      setDetailsSaved(true);
      router.refresh();
    } else {
      alert(await parseError(res));
    }
  }

  async function handleSaveTreasurer(e: React.FormEvent) {
    e.preventDefault();
    setSavingTreasurer(true);
    setTreasurerSaved(false);

    const res = await fetch(apiBase, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submittedBy: treasurerForm.submittedBy,
        dateDue: treasurerForm.dateDue,
        dateSubmitted: treasurerForm.dateSubmitted,
        datePresented: treasurerForm.datePresented,
        motion: treasurerForm.motion,
        second: treasurerForm.second,
        vote: treasurerForm.vote,
        status: treasurerForm.status,
        checkNumber: treasurerForm.checkNumber,
        checkAmount: treasurerForm.checkAmount ? parseFloat(treasurerForm.checkAmount) : 0,
        dateReceived: treasurerForm.dateReceived,
        reimbursementMethod: treasurerForm.reimbursementMethod,
      }),
    });

    setSavingTreasurer(false);

    if (res.ok) {
      const updated: VersionWithItems = await res.json();
      setVersion(updated);
      setTreasurerSaved(true);
    } else {
      alert(await parseError(res));
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!addItemForm.item.trim()) {
      setAddItemError("Item name is required.");
      return;
    }
    if (!addItemForm.accountCode) {
      setAddItemError("Category is required.");
      return;
    }
    setAddingItem(true);
    setAddItemError(null);

    const res = await fetch(`${apiBase}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: addItemForm.item,
        quantity: parseFloat(addItemForm.quantity) || 0,
        price: parseFloat(addItemForm.price) || 0,
        taxable: addItemForm.taxable,
        accountCode: addItemForm.accountCode ? parseInt(addItemForm.accountCode, 10) : null,
      }),
    });

    setAddingItem(false);

    if (!res.ok) {
      setAddItemError(await parseError(res));
      return;
    }

    const created: BudgetLineItem = await res.json();
    setLineItems((prev) => [...prev, created]);
    setAddItemForm(EMPTY_ITEM_FORM);
    setShowAddItem(false);
  }

  function startEditItem(item: BudgetLineItem) {
    setEditingItemId(item.id);
    setEditItemForm({
      item: item.item,
      quantity: String(item.quantity),
      price: String(item.price),
      taxable: item.taxable,
      accountCode: item.accountCode != null ? String(item.accountCode) : "",
    });
    setEditItemError(null);
  }

  async function handleSaveItem(id: string) {
    if (!editItemForm.item.trim()) {
      setEditItemError("Item name is required.");
      return;
    }
    if (!editItemForm.accountCode) {
      setEditItemError("Category is required.");
      return;
    }
    setEditItemError(null);
    setSavingItem(true);

    const res = await fetch(`${apiBase}/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: editItemForm.item,
        quantity: parseFloat(editItemForm.quantity) || 0,
        price: parseFloat(editItemForm.price) || 0,
        taxable: editItemForm.taxable,
        accountCode: editItemForm.accountCode ? parseInt(editItemForm.accountCode, 10) : null,
      }),
    });

    setSavingItem(false);

    if (res.ok) {
      const updated: BudgetLineItem = await res.json();
      setLineItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setEditingItemId(null);
    } else {
      setEditItemError(await parseError(res));
    }
  }

  async function handleDeleteItem(item: BudgetLineItem) {
    if (!confirmDelete(`Remove "${item.item}" from this budget?`)) return;
    const res = await fetch(`${apiBase}/items/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setLineItems((prev) => prev.filter((i) => i.id !== item.id));
    } else {
      alert(await parseError(res));
    }
  }

  function toggleImportSelection(itemId: string) {
    setSelectedImportIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  async function handleImportSelected() {
    if (!importSource || selectedImportIds.size === 0) return;
    setImporting(true);
    setImportError(null);

    const toImport = importSource.lineItems.filter((i) => selectedImportIds.has(i.id));
    const imported: BudgetLineItem[] = [];
    const importedSourceIds: string[] = [];
    let failed = false;

    // One request at a time (not Promise.all) — the API assigns each new
    // item's sortOrder from the current count, so importing several at
    // once in parallel could race and hand out the same number twice.
    for (const item of toImport) {
      const res = await fetch(`${apiBase}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: item.item,
          quantity: item.quantity,
          price: item.price,
          taxable: item.taxable,
          accountCode: item.accountCode,
        }),
      });
      if (!res.ok) {
        setImportError(await parseError(res));
        failed = true;
        break;
      }
      imported.push(await res.json());
      importedSourceIds.push(item.id);
    }

    setImporting(false);
    if (imported.length > 0) {
      setLineItems((prev) => [...prev, ...imported]);
      setSelectedImportIds((prev) => {
        const next = new Set(prev);
        importedSourceIds.forEach((id) => next.delete(id));
        return next;
      });
    }
    if (!failed) {
      setShowImport(false);
    }
  }

  async function handleUploadReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again later if needed
    if (!file) return;

    setUploadingReceipt(true);
    setReceiptError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${apiBase}/receipts`, { method: "POST", body: formData });

    setUploadingReceipt(false);

    if (!res.ok) {
      setReceiptError(await parseError(res));
      return;
    }

    const created: ReceiptSummary = await res.json();
    setReceipts((prev) => [...prev, created]);
  }

  async function handleDeleteReceipt(receipt: ReceiptSummary) {
    if (!confirmDelete(`Remove "${receipt.filename}"? This can't be undone.`)) return;
    setDeletingReceiptId(receipt.id);
    const res = await fetch(`${apiBase}/receipts/${receipt.id}`, { method: "DELETE" });
    setDeletingReceiptId(null);
    if (res.ok) {
      setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
    } else {
      setReceiptError(await parseError(res));
    }
  }

  async function handleDeleteVersion() {
    if (
      !confirmDelete(
        `Delete the ${BUDGET_STAGE_LABELS[stage]} budget for "${budget.eventName}"? This can't be undone.`
      )
    )
      return;
    setDeletingVersion(true);
    const res = await fetch(apiBase, { method: "DELETE" });
    setDeletingVersion(false);
    if (res.ok) {
      router.push(`/budgets/${budget.id}`);
      router.refresh();
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div>
      <Link href={`/budgets/${budget.id}`} className="text-sm text-stone-500 hover:text-burgundy-700">
        ← Back to {budget.eventName}
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-stone-900">
              {BUDGET_STAGE_LABELS[stage]} Budget
            </h1>
            {/* Aug 2026 — this used to only show on Final; Tentative
                budgets go up for a chapter vote too, so both stages get
                the same Approved/Awaiting Approval/Failed/Tabled badge
                now. See lib/budgets.ts isApprovedVersion/isPendingApproval. */}
            {isApprovedVersion(version) ? (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                Approved
              </span>
            ) : isPendingApproval(version) ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Awaiting Approval
              </span>
            ) : (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                {version.status}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-500">{budget.eventName}</p>
          {stage === "FINAL" && !isApprovedVersion(version) && (
            <p className="mt-1 text-xs text-stone-400">
              Doesn&apos;t count toward Chapter Finances or export to Financial
              Books until Status below is set to &quot;Passed.&quot;
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`${apiBase}/export`}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Export to Excel
          </a>
          <button
            onClick={handleDeleteVersion}
            disabled={deletingVersion}
            className="text-sm font-medium text-stone-400 hover:text-red-600 disabled:opacity-50"
          >
            {deletingVersion ? "Deleting..." : `Delete ${BUDGET_STAGE_LABELS[stage].toLowerCase()}`}
          </button>
        </div>
      </div>

      {/* Details */}
      <form
        onSubmit={handleSaveDetails}
        className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2"
      >
        <div>
          <label className="block text-xs font-medium text-stone-600">
            Sales Tax % <span className="text-burgundy-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={detailsForm.salesTaxRatePercent}
            onChange={(e) => {
              setDetailsForm({ ...detailsForm, salesTaxRatePercent: e.target.value });
              setDetailsSaved(false);
              setDetailsError(null);
            }}
            required
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-stone-600">
            Notes{" "}
            <span className="text-stone-400">
              (special circumstances, who to reimburse, etc.)
            </span>
          </label>
          <textarea
            value={detailsForm.notes}
            onChange={(e) => {
              setDetailsForm({ ...detailsForm, notes: e.target.value });
              setDetailsSaved(false);
            }}
            rows={2}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
          />
        </div>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={savingDetails}
            className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
          >
            {savingDetails ? "Saving..." : "Save details"}
          </button>
          {detailsError && <p className="text-sm text-red-600">{detailsError}</p>}
          {detailsSaved && !detailsError && <p className="text-sm text-green-600">Saved.</p>}
        </div>
      </form>

      {/* Line items */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-medium text-stone-900">Line Items</h2>
        <div className="flex items-center gap-2">
          {importSource && importSource.lineItems.length > 0 && (
            <button
              onClick={() => {
                setShowImport((prev) => !prev);
                setImportError(null);
              }}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              {showImport ? "Cancel Import" : "Import from Tentative Budget"}
            </button>
          )}
          <button
            onClick={() => {
              setShowAddItem((prev) => !prev);
              setAddItemError(null);
            }}
            className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700"
          >
            {showAddItem ? "Cancel" : "Add Item"}
          </button>
        </div>
      </div>

      {showImport && importSource && (
        <div className="mt-3 rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">
            Check off which of the Tentative Budget&apos;s line items to copy
            in — nothing&apos;s imported until you hit &quot;Import
            Selected.&quot;
          </p>
          <ul className="mt-3 divide-y divide-stone-100">
            {importSource.lineItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <input
                  id={`import-${item.id}`}
                  type="checkbox"
                  checked={selectedImportIds.has(item.id)}
                  onChange={() => toggleImportSelection(item.id)}
                  className="h-4 w-4 rounded border-stone-300 text-burgundy-600 focus:ring-burgundy-400"
                />
                <label htmlFor={`import-${item.id}`} className="flex-1 text-sm text-stone-700">
                  <span className="font-medium text-stone-900">{item.item}</span>{" "}
                  <span className="text-stone-500">
                    — {item.quantity} × {money(item.price)} = {money(item.quantity * item.price)}
                    {item.taxable ? " (taxable)" : ""}
                    {item.accountCode != null ? ` · ${accountLabel(item.accountCode)}` : ""}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleImportSelected}
              disabled={importing || selectedImportIds.size === 0}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
            >
              {importing
                ? "Importing..."
                : `Import Selected${selectedImportIds.size > 0 ? ` (${selectedImportIds.size})` : ""}`}
            </button>
            {importError && <p className="text-sm text-red-600">{importError}</p>}
          </div>
        </div>
      )}

      {showAddItem && (
        <form
          onSubmit={handleAddItem}
          className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-6"
        >
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-stone-600">Item</label>
            <input
              value={addItemForm.item}
              onChange={(e) => setAddItemForm({ ...addItemForm, item: e.target.value })}
              autoFocus
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Quantity</label>
            <input
              type="number"
              step="1"
              value={addItemForm.quantity}
              onChange={(e) => setAddItemForm({ ...addItemForm, quantity: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Price</label>
            <input
              type="number"
              step="0.01"
              value={addItemForm.price}
              onChange={(e) => setAddItemForm({ ...addItemForm, price: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Category <span className="text-burgundy-500">*</span>
            </label>
            <select
              value={addItemForm.accountCode}
              onChange={(e) => setAddItemForm({ ...addItemForm, accountCode: e.target.value })}
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            >
              <option value="">— Select —</option>
              {EXPENSE_ACCOUNTS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} — {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 pb-1.5">
            <input
              id="taxable"
              type="checkbox"
              checked={addItemForm.taxable}
              onChange={(e) => setAddItemForm({ ...addItemForm, taxable: e.target.checked })}
              className="h-4 w-4 rounded border-stone-300 text-burgundy-600 focus:ring-burgundy-400"
            />
            <label htmlFor="taxable" className="text-sm text-stone-600">
              Taxable?
            </label>
          </div>

          <div className="sm:col-span-2 lg:col-span-6">
            {addItemError && <p className="mb-2 text-sm text-red-600">{addItemError}</p>}
            <button
              type="submit"
              disabled={addingItem}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
            >
              {addingItem ? "Adding..." : "Add item"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {[
                "Item",
                "Quantity",
                "Price",
                "Taxable?",
                ...(stage === "FINAL" ? ["Tax"] : []),
                "Category",
                "Total",
                "",
              ].map((h) => (
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
            {lineItems.length === 0 && (
              <tr>
                <td
                  colSpan={stage === "FINAL" ? 8 : 7}
                  className="px-4 py-8 text-center text-stone-400"
                >
                  No line items yet. Add the first one above.
                </td>
              </tr>
            )}

            {lineItems.map((item) => {
              const isEditing = editingItemId === item.id;

              if (isEditing) {
                return (
                  <tr key={item.id} className="bg-burgundy-50/40">
                    <td className="px-4 py-2">
                      <input
                        value={editItemForm.item}
                        onChange={(e) =>
                          setEditItemForm({ ...editItemForm, item: e.target.value })
                        }
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="1"
                        value={editItemForm.quantity}
                        onChange={(e) =>
                          setEditItemForm({ ...editItemForm, quantity: e.target.value })
                        }
                        className="w-20 rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editItemForm.price}
                        onChange={(e) =>
                          setEditItemForm({ ...editItemForm, price: e.target.value })
                        }
                        className="w-24 rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={editItemForm.taxable}
                        onChange={(e) =>
                          setEditItemForm({ ...editItemForm, taxable: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-stone-300 text-burgundy-600 focus:ring-burgundy-400"
                      />
                    </td>
                    {stage === "FINAL" && (
                      <td className="px-4 py-2 text-stone-500">
                        {money(
                          editItemForm.taxable
                            ? (parseFloat(editItemForm.quantity) || 0) *
                                (parseFloat(editItemForm.price) || 0) *
                                salesTaxRate
                            : 0
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <select
                        value={editItemForm.accountCode}
                        onChange={(e) =>
                          setEditItemForm({ ...editItemForm, accountCode: e.target.value })
                        }
                        required
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      >
                        <option value="">— Select —</option>
                        {EXPENSE_ACCOUNTS.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} — {a.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-stone-500">
                      {money(
                        (parseFloat(editItemForm.quantity) || 0) *
                          (parseFloat(editItemForm.price) || 0)
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleSaveItem(item.id)}
                        disabled={savingItem}
                        className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingItemId(null);
                          setEditItemError(null);
                        }}
                        className="ml-3 text-sm font-medium text-stone-500 hover:text-stone-700"
                      >
                        Cancel
                      </button>
                      {editItemError && (
                        <p className="mt-1 text-xs text-red-600">{editItemError}</p>
                      )}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={item.id}>
                  <td className="px-4 py-2.5 font-medium text-stone-900">{item.item}</td>
                  <td className="px-4 py-2.5 text-stone-600">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-stone-600">{money(item.price)}</td>
                  <td className="px-4 py-2.5 text-stone-600">{item.taxable ? "Yes" : "No"}</td>
                  {stage === "FINAL" && (
                    <td className="px-4 py-2.5 text-stone-500">
                      {money(item.taxable ? item.quantity * item.price * salesTaxRate : 0)}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-stone-500">
                    {item.accountCode != null ? accountLabel(item.accountCode) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {money(item.quantity * item.price)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <button
                      onClick={() => startEditItem(item)}
                      className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="ml-3 text-sm font-medium text-stone-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-stone-200 bg-stone-50 px-4 py-3">
          <div className="ml-auto flex max-w-xs flex-col gap-1 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Tax</span>
              <span>{money(totals.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-stone-300 pt-1 font-semibold text-stone-900">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Receipts */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-medium text-stone-900">Receipts</h2>
        <label className="cursor-pointer rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700">
          {uploadingReceipt ? "Uploading..." : "Upload Receipt"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
            onChange={handleUploadReceipt}
            disabled={uploadingReceipt}
            className="hidden"
          />
        </label>
      </div>
      {receiptError && <p className="mt-2 text-sm text-red-600">{receiptError}</p>}
      <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-white">
        {receipts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-stone-400">
            No receipts uploaded yet. Photos and PDFs both work.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="flex items-center justify-between px-4 py-2.5">
                <a
                  href={`${apiBase}/receipts/${receipt.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800 hover:underline"
                >
                  {receipt.filename}
                </a>
                <div className="flex items-center gap-3 text-xs text-stone-400">
                  <span>{formatFileSize(receipt.size)}</span>
                  <span>
                    {new Date(receipt.uploadedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    onClick={() => handleDeleteReceipt(receipt)}
                    disabled={deletingReceiptId === receipt.id}
                    className="font-medium text-stone-400 hover:text-red-600 disabled:opacity-50"
                  >
                    {deletingReceiptId === receipt.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Treasurer / Auditor section */}
      <details className="mt-6 rounded-lg border border-stone-200 bg-white">
        <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium text-stone-700">
          NVP Finance / Comptroller Use Only
        </summary>
        <form
          onSubmit={handleSaveTreasurer}
          className="grid grid-cols-1 gap-4 border-t border-stone-200 p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {(
            [
              ["submittedBy", "Submitted By"],
              ["dateDue", "Date Due"],
              ["dateSubmitted", "Date Submitted"],
              ["datePresented", "Date Presented"],
              ["motion", "Motion"],
              ["second", "Second"],
              ["vote", "Vote"],
              ["status", "Status"],
              ["checkNumber", "Check #"],
              ["checkAmount", "Check Amount"],
              ["dateReceived", "Date Rec'd"],
              ["reimbursementMethod", "Reimbursement Method"],
            ] as const
          ).map(([key, label]) => {
            const inputClass =
              "mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400";
            const onChange = (value: string) => {
              setTreasurerForm({ ...treasurerForm, [key]: value });
              setTreasurerSaved(false);
            };

            let field: React.ReactNode;
            if (key === "status") {
              field = (
                <select
                  value={treasurerForm.status}
                  onChange={(e) => onChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select —</option>
                  {BUDGET_LOG_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              );
            } else if (key === "reimbursementMethod") {
              field = (
                <select
                  value={treasurerForm.reimbursementMethod}
                  onChange={(e) => onChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select —</option>
                  {REIMBURSEMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              );
            } else {
              const isDateField =
                key === "dateDue" ||
                key === "dateSubmitted" ||
                key === "datePresented" ||
                key === "dateReceived";
              field = (
                <input
                  type={key === "checkAmount" ? "number" : isDateField ? "date" : "text"}
                  step={key === "checkAmount" ? "0.01" : undefined}
                  value={treasurerForm[key]}
                  onChange={(e) => onChange(e.target.value)}
                  className={inputClass}
                />
              );
            }

            return (
              <div key={key}>
                <label className="block text-xs font-medium text-stone-600">{label}</label>
                {field}
              </div>
            );
          })}

          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={savingTreasurer}
              className="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900 disabled:opacity-50"
            >
              {savingTreasurer ? "Saving..." : "Save"}
            </button>
            {treasurerSaved && <p className="text-sm text-green-600">Saved.</p>}
          </div>
        </form>
      </details>
    </div>
  );
}
