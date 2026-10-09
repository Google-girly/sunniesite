"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChapterFundEntry, ChapterStartingBalance } from "@/app/generated/prisma/client";
import { INCOME_ACCOUNTS, incomeAccountLabel } from "@/lib/financialBooksAccounts";
import { Section, inputClass, labelClass, th, td, parseFormError as parseError } from "@/components/FormSection";
import { confirmDelete } from "@/lib/confirmDelete";

function StartingBalanceSection({ initial }: { initial: ChapterStartingBalance[] }) {
  const router = useRouter();
  const [balances, setBalances] = useState(initial);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [amount, setAmount] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/finances/starting-balance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: Number(year),
        amount: Number(amount),
        asOfDate: asOfDate || undefined,
        notes: notes || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const saved: ChapterStartingBalance = await res.json();
    setBalances((prev) => {
      const rest = prev.filter((b) => b.year !== saved.year);
      return [saved, ...rest].sort((a, b) => b.year - a.year);
    });
    setAmount("");
    setAsOfDate("");
    setNotes("");
    router.refresh();
  }

  return (
    <Section
      title="Starting Balance"
      description="Set once per year — writes into the real Financial Books Checkbook sheet's own 'Starting Balance' row (H9) on export, the anchor every other row's running balance chains off of."
    >
      <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Year</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Starting Balance</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>As Of</label>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-4 flex items-center gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Set Starting Balance"}
          </button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Year", "Starting Balance", "As Of", "Notes"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {balances.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-stone-400">
                  No starting balance on file yet.
                </td>
              </tr>
            )}
            {balances.map((b) => (
              <tr key={b.id}>
                <td className={td}>{b.year}</td>
                <td className={td}>${b.amount.toFixed(2)}</td>
                <td className={td}>{b.asOfDate || "—"}</td>
                <td className={td}>{b.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

interface FundEntryFormValues {
  date: string;
  description: string;
  amount: string;
  accountCode: string;
  notes: string;
}

const emptyFundForm: FundEntryFormValues = { date: "", description: "", amount: "", accountCode: "", notes: "" };

function fundEntryToForm(e: ChapterFundEntry): FundEntryFormValues {
  return {
    date: e.date,
    description: e.description,
    amount: String(e.amount),
    accountCode: String(e.accountCode),
    notes: e.notes,
  };
}

function fundFormToBody(form: FundEntryFormValues) {
  return {
    date: form.date,
    description: form.description,
    amount: Number(form.amount),
    accountCode: Number(form.accountCode),
    notes: form.notes,
  };
}

function FundEntryForm({
  form,
  setForm,
  error,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  form: FundEntryFormValues;
  setForm: (form: FundEntryFormValues) => void;
  error: string | null;
  saving: boolean;
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className={labelClass}>Date *</label>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} required />
      </div>
      <div className="lg:col-span-2">
        <label className={labelClass}>Description *</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} required />
      </div>
      <div>
        <label className={labelClass}>Amount *</label>
        <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} required />
      </div>
      <div>
        <label className={labelClass}>Code *</label>
        <select
          value={form.accountCode}
          onChange={(e) => setForm({ ...form, accountCode: e.target.value })}
          className={inputClass}
          required
        >
          <option value="">— Select —</option>
          {INCOME_ACCOUNTS.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} — {a.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <label className={labelClass}>Notes *</label>
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} required />
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
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

function FundEntrySection({ initial }: { initial: ChapterFundEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initial);
  const [form, setForm] = useState<FundEntryFormValues>(emptyFundForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FundEntryFormValues>(emptyFundForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function sortByDate(list: ChapterFundEntry[]): ChapterFundEntry[] {
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/finances/fund-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fundFormToBody(form)),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created: ChapterFundEntry = await res.json();
    setEntries((prev) => sortByDate([created, ...prev]));
    setForm(emptyFundForm);
    router.refresh();
  }

  function startEdit(entry: ChapterFundEntry) {
    setEditingId(entry.id);
    setEditForm(fundEntryToForm(entry));
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    setSavingEdit(true);
    setEditError(null);
    const res = await fetch(`/api/finances/fund-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fundFormToBody(editForm)),
    });
    setSavingEdit(false);
    if (!res.ok) {
      setEditError(await parseError(res));
      return;
    }
    const updated: ChapterFundEntry = await res.json();
    setEntries((prev) => sortByDate(prev.map((e) => (e.id === id ? updated : e))));
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this fund entry?")) return;
    const res = await fetch(`/api/finances/fund-entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      router.refresh();
    } else alert(await parseError(res));
  }

  return (
    <Section
      title="Add Funds"
      description="Deposits into the chapter account — dues, fundraiser income, donations, etc. Categorized by the same account codes the real Financial Books 'Accounts' sheet uses, so each one lands in Checkbook with a real, auditable code instead of a bare dollar figure. Fines cleared as paid from Fines & Member Accounts show up here automatically."
    >
      <FundEntryForm form={form} setForm={setForm} error={error} saving={saving} submitLabel="Add" onSubmit={handleAdd} />

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Date", "Description", "Amount", "Code", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-stone-400">
                  No fund entries on file.
                </td>
              </tr>
            )}
            {entries.map((e) =>
              editingId === e.id ? (
                <tr key={e.id}>
                  <td colSpan={5} className="bg-burgundy-50/40 px-3 py-4">
                    <FundEntryForm
                      form={editForm}
                      setForm={setEditForm}
                      error={editError}
                      saving={savingEdit}
                      submitLabel="Save"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        handleSaveEdit(e.id);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td className={td}>{e.date}</td>
                  <td className={td}>{e.description}</td>
                  <td className={td}>${e.amount.toFixed(2)}</td>
                  <td className={td}>
                    {e.accountCode} — {incomeAccountLabel(e.accountCode)}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <button onClick={() => startEdit(e)} className="text-xs font-medium text-burgundy-600 hover:text-burgundy-800">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(e.id)} className="ml-3 text-xs font-medium text-stone-400 hover:text-red-600">
                      Remove
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function ChapterAccountLedgerSection({
  initialStartingBalances,
  initialFundEntries,
}: {
  initialStartingBalances: ChapterStartingBalance[];
  initialFundEntries: ChapterFundEntry[];
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-stone-900">Chapter Account Ledger</h2>
      <StartingBalanceSection initial={initialStartingBalances} />
      <FundEntrySection initial={initialFundEntries} />
    </div>
  );
}
