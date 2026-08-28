"use client";

import { useState } from "react";
import type { ChapterFundEntry, ChapterStartingBalance } from "@/app/generated/prisma/client";
import { INCOME_ACCOUNTS, incomeAccountLabel } from "@/lib/financialBooksAccounts";
import { Section, inputClass, labelClass, th, td, parseFormError as parseError } from "@/components/FormSection";
import { confirmDelete } from "@/lib/confirmDelete";

function StartingBalanceSection({ initial }: { initial: ChapterStartingBalance[] }) {
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

function FundEntrySection({ initial }: { initial: ChapterFundEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/finances/fund-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        description,
        amount: Number(amount),
        accountCode: Number(accountCode),
        notes,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created: ChapterFundEntry = await res.json();
    setEntries((prev) => [created, ...prev]);
    setDate("");
    setDescription("");
    setAmount("");
    setAccountCode("");
    setNotes("");
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this fund entry?")) return;
    const res = await fetch(`/api/finances/fund-entries/${id}`, { method: "DELETE" });
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Add Funds"
      description="Deposits into the chapter account — dues, fundraiser income, donations, etc. Categorized by the same account codes the real Financial Books 'Accounts' sheet uses, so each one lands in Checkbook with a real, auditable code instead of a bare dollar figure."
    >
      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className={labelClass}>Date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </div>
        <div className="lg:col-span-2">
          <label className={labelClass}>Description *</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Amount *</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Code *</label>
          <select
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
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
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} required />
        </div>
        <div className="sm:col-span-2 lg:col-span-5">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      </form>

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
            {entries.map((e) => (
              <tr key={e.id}>
                <td className={td}>{e.date}</td>
                <td className={td}>{e.description}</td>
                <td className={td}>${e.amount.toFixed(2)}</td>
                <td className={td}>
                  {e.accountCode} — {incomeAccountLabel(e.accountCode)}
                </td>
                <td className={`${td} text-right`}>
                  <button onClick={() => handleDelete(e.id)} className="text-xs font-medium text-stone-400 hover:text-red-600">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
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
