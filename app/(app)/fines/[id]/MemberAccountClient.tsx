"use client";

import Link from "next/link";
import { useState } from "react";
import type { AccountEntry, Member } from "@/app/generated/prisma/client";
import { formatEventDate, REIMBURSEMENT_METHODS } from "@/lib/budgets";
import {
  calculateBalance,
  ENTRY_TYPE_LABELS,
  ENTRY_TYPES,
  findFine,
  formatCurrency,
  groupFinesByCategory,
  isChargeType,
  isEntryType,
  type EntryType,
} from "@/lib/fines";
import { todayIso } from "@/lib/meetings";
import { MEMBER_STATUS_LABELS, type MemberStatus } from "@/lib/roster";
import { confirmDelete } from "@/lib/confirmDelete";

type MemberWithEntries = Member & { accountEntries: AccountEntry[] };

interface EntryFormValues {
  type: EntryType;
  fineCode: string; // "" = custom (manual description/amount); only used when type === "FINE"
  description: string;
  amount: string;
  date: string;
  method: string; // only shown/used when type === "PAYMENT"; optional
  notes: string;
}

function emptyForm(): EntryFormValues {
  return {
    type: "FINE",
    fineCode: "",
    description: "",
    amount: "",
    date: todayIso(),
    method: "",
    notes: "",
  };
}

function entryToForm(entry: AccountEntry): EntryFormValues {
  return {
    type: isEntryType(entry.type) ? entry.type : "FINE",
    fineCode: entry.fineCode ?? "",
    description: entry.description,
    amount: String(entry.amount),
    date: entry.date,
    method: "",
    notes: entry.notes ?? "",
  };
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

const TYPE_BADGE_CLASSES: Record<EntryType, string> = {
  DUES: "bg-amber-50 text-amber-700",
  FINE: "bg-burgundy-50 text-burgundy-700",
  PAYMENT: "bg-green-50 text-green-700",
  CREDIT: "bg-purple-50 text-purple-700",
};

function EntryForm({
  form,
  setForm,
  error,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  form: EntryFormValues;
  setForm: (form: EntryFormValues) => void;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  const fineGroups = groupFinesByCategory();

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div>
        <label className="block text-xs font-medium text-stone-600">Type</label>
        <select
          value={form.type}
          onChange={(e) => {
            const type = e.target.value as EntryType;
            setForm({
              ...form,
              type,
              fineCode: "",
              description: type === "FINE" ? "" : form.description,
              amount: type === "FINE" ? "" : form.amount,
            });
          }}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        >
          {ENTRY_TYPES.map((t) => (
            <option key={t} value={t}>
              {ENTRY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {form.type === "FINE" && (
        <div>
          <label className="block text-xs font-medium text-stone-600">From Schedule</label>
          <select
            value={form.fineCode}
            onChange={(e) => {
              const code = e.target.value;
              const fine = findFine(code);
              setForm({
                ...form,
                fineCode: code,
                description: fine ? fine.label : form.description,
                amount: fine ? String(fine.amount) : form.amount,
              });
            }}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
          >
            <option value="">— Custom (type below) —</option>
            {fineGroups.map((group) => (
              <optgroup key={group.category} label={group.category}>
                {group.fines.map((fine) => (
                  <option key={fine.code} value={fine.code}>
                    {fine.label} — {formatCurrency(fine.amount)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-stone-600">
          Description <span className="text-burgundy-500">*</span>
        </label>
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600">
          Amount <span className="text-burgundy-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600">
          Date <span className="text-burgundy-500">*</span>
        </label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>

      {form.type === "PAYMENT" && (
        <div>
          <label className="block text-xs font-medium text-stone-600">
            Method <span className="text-stone-400">(optional)</span>
          </label>
          <select
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
          >
            <option value="">— None —</option>
            {REIMBURSEMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="sm:col-span-2 lg:col-span-3">
        <label className="block text-xs font-medium text-stone-600">
          Notes <span className="text-stone-400">(optional)</span>
        </label>
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-4 py-2 text-sm font-medium text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

export function MemberAccountClient({ member }: { member: MemberWithEntries }) {
  const [entries, setEntries] = useState<AccountEntry[]>(member.accountEntries);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<EntryFormValues>(emptyForm());
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryFormValues>(emptyForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const balance = calculateBalance(entries);

  function sortByDate(list: AccountEntry[]): AccountEntry[] {
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }

  function validate(form: EntryFormValues): string | null {
    if (!form.description.trim()) return "Description is required.";
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return "Amount must be greater than zero.";
    if (!form.date) return "Date is required.";
    return null;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate(addForm);
    if (validationError) {
      setAddError(validationError);
      return;
    }
    setAdding(true);
    setAddError(null);

    const res = await fetch("/api/fines/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: member.id,
        type: addForm.type,
        fineCode: addForm.type === "FINE" ? addForm.fineCode || undefined : undefined,
        description: addForm.description.trim(),
        amount: parseFloat(addForm.amount),
        date: addForm.date,
        notes: addForm.method
          ? [addForm.notes.trim(), `Method: ${addForm.method}`].filter(Boolean).join(" — ")
          : addForm.notes.trim() || undefined,
      }),
    });

    setAdding(false);

    if (!res.ok) {
      setAddError(await parseError(res));
      return;
    }

    const created: AccountEntry = await res.json();
    setEntries((prev) => sortByDate([...prev, created]));
    setAddForm(emptyForm());
    setShowAddForm(false);
  }

  function startEdit(entry: AccountEntry) {
    setEditingId(entry.id);
    setEditForm(entryToForm(entry));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    const validationError = validate(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }
    setSavingEdit(true);
    setEditError(null);

    const res = await fetch(`/api/fines/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: editForm.type,
        fineCode: editForm.type === "FINE" ? editForm.fineCode || null : null,
        description: editForm.description.trim(),
        amount: parseFloat(editForm.amount),
        date: editForm.date,
        notes: editForm.notes.trim() || null,
      }),
    });

    setSavingEdit(false);

    if (!res.ok) {
      setEditError(await parseError(res));
      return;
    }

    const updated: AccountEntry = await res.json();
    setEntries((prev) => sortByDate(prev.map((e) => (e.id === id ? updated : e))));
    setEditingId(null);
  }

  async function handleDelete(entry: AccountEntry) {
    if (!confirmDelete(`Remove this ${ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type} entry (${entry.description})?`))
      return;
    setDeletingId(entry.id);
    const res = await fetch(`/api/fines/entries/${entry.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div>
      <Link href="/fines" className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800">
        ← All Members
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{member.name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {member.role || "General member"} ·{" "}
            {MEMBER_STATUS_LABELS[member.status as MemberStatus] ?? member.status}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white px-5 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Current Balance
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              balance > 0 ? "text-burgundy-600" : balance < 0 ? "text-purple-600" : "text-green-600"
            }`}
          >
            {balance === 0
              ? "Paid up"
              : balance > 0
                ? `${formatCurrency(balance)} owed`
                : `${formatCurrency(Math.abs(balance))} credit`}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"}
        </p>
        <button
          onClick={() => {
            setShowAddForm((prev) => !prev);
            setAddForm(emptyForm());
            setAddError(null);
          }}
          className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700"
        >
          {showAddForm ? "Cancel" : "Add Entry"}
        </button>
      </div>

      {showAddForm && (
        <EntryForm
          form={addForm}
          setForm={setAddForm}
          error={addError}
          onSubmit={handleAdd}
          saving={adding}
          submitLabel="Add entry"
        />
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Date", "Type", "Description", "Notes", "Amount", ""].map((h) => (
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
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  No entries yet. Add the first one above.
                </td>
              </tr>
            )}

            {entries.map((entry) => {
              const isEditing = editingId === entry.id;
              const type: EntryType = isEntryType(entry.type) ? entry.type : "FINE";

              if (isEditing) {
                return (
                  <tr key={entry.id}>
                    <td colSpan={6} className="bg-burgundy-50/40 px-4 py-4">
                      <EntryForm
                        form={editForm}
                        setForm={setEditForm}
                        error={editError}
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveEdit(entry.id);
                        }}
                        onCancel={cancelEdit}
                        saving={savingEdit}
                        submitLabel="Save"
                      />
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={entry.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-stone-600">
                    {formatEventDate(entry.date)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASSES[type]}`}
                    >
                      {ENTRY_TYPE_LABELS[type]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-stone-900">{entry.description}</td>
                  <td className="px-4 py-2.5 text-stone-500">{entry.notes || "—"}</td>
                  <td
                    className={`px-4 py-2.5 whitespace-nowrap font-medium ${
                      isChargeType(type) ? "text-burgundy-600" : "text-green-600"
                    }`}
                  >
                    {isChargeType(type) ? "+" : "–"}
                    {formatCurrency(entry.amount)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <button
                      onClick={() => startEdit(entry)}
                      className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      disabled={deletingId === entry.id}
                      className="ml-3 text-sm font-medium text-stone-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
