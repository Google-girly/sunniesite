"use client";

import { useState } from "react";
import type { Letter } from "@/app/generated/prisma/client";
import { LETTER_TYPES, letterTitle, type LetterType } from "@/lib/letters";
import { inputClass, labelClass, th, td } from "@/components/FormSection";
import { confirmDelete } from "@/lib/confirmDelete";

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

// Matches app/api/letters/[id]/add-to-minutes's own ELIGIBLE_LETTER_TYPES.
const ADD_TO_MINUTES_TYPES = ["Letter of Excuse", "Active Member Request"];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  type: "Letter of Excuse" as LetterType,
  typeOther: "",
  recipientName: "",
  date: todayIso(),
  purpose: "",
};

export function LettersClient({
  initialLetters,
  viewerId,
  canSeeAll,
}: {
  initialLetters: Letter[];
  viewerId: string;
  canSeeAll: boolean;
}) {
  const [letters, setLetters] = useState(initialLetters);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingToMinutesId, setAddingToMinutesId] = useState<string | null>(null);
  const [minutesError, setMinutesError] = useState<string | null>(null);

  async function handleAddToMinutes(id: string) {
    setAddingToMinutesId(id);
    setMinutesError(null);
    const res = await fetch(`/api/letters/${id}/add-to-minutes`, { method: "POST" });
    setAddingToMinutesId(null);
    if (!res.ok) {
      setMinutesError(await parseError(res));
      return;
    }
    const { meetingId } = await res.json();
    setLetters((prev) => prev.map((l) => (l.id === id ? { ...l, addedToMeetingId: meetingId } : l)));
  }

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.purpose.trim()) {
      setError("Purpose / letter body is required.");
      return;
    }
    if (form.type === "Other" && !form.typeOther.trim()) {
      setError("Enter what kind of letter this is.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/letters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        typeOther: form.typeOther || undefined,
        recipientName: form.recipientName || undefined,
        date: form.date,
        purpose: form.purpose,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created: Letter = await res.json();
    setLetters((prev) => [created, ...prev]);
    setForm(EMPTY_FORM);
    setShowAdd(false);
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this letter?")) return;
    const res = await fetch(`/api/letters/${id}`, { method: "DELETE" });
    if (res.ok) setLetters((prev) => prev.filter((l) => l.id !== id));
    else alert(await parseError(res));
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700"
        >
          {showAdd ? "Cancel" : "New Letter"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2"
        >
          <div>
            <label className={labelClass}>
              Type <span className="text-burgundy-500">*</span>
            </label>
            <select value={form.type} onChange={(e) => update("type", e.target.value as LetterType)} className={inputClass}>
              {LETTER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {form.type === "Other" && (
            <div>
              <label className={labelClass}>
                What kind of letter? <span className="text-burgundy-500">*</span>
              </label>
              <input
                value={form.typeOther}
                onChange={(e) => update("typeOther", e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className={labelClass}>
              Date <span className="text-burgundy-500">*</span>
            </label>
            <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>To / Recipient</label>
            <input
              value={form.recipientName}
              onChange={(e) => update("recipientName", e.target.value)}
              placeholder="Optional — e.g. a professor's name"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>
              Purpose / Letter Body <span className="text-burgundy-500">*</span>
            </label>
            <textarea
              value={form.purpose}
              onChange={(e) => update("purpose", e.target.value)}
              rows={5}
              placeholder="What this letter is for — this becomes the letter's body text."
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create Letter"}
            </button>
          </div>
        </form>
      )}

      {minutesError && <p className="mt-3 text-sm text-red-600">{minutesError}</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Date", "Type", "Purpose", ...(canSeeAll ? ["Created By"] : []), ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {letters.length === 0 && (
              <tr>
                <td colSpan={canSeeAll ? 5 : 4} className="px-4 py-8 text-center text-stone-400">
                  No letters yet.
                </td>
              </tr>
            )}
            {letters.map((l) => {
              const canManage = l.createdByMemberId === viewerId || canSeeAll;
              const eligibleForMinutes = ADD_TO_MINUTES_TYPES.includes(l.type);
              return (
                <tr key={l.id}>
                  <td className={`${td} font-medium text-stone-900`}>{l.date}</td>
                  <td className={td}>{letterTitle(l)}</td>
                  <td className={`${td} max-w-sm truncate`} title={l.purpose}>
                    {l.purpose}
                  </td>
                  {canSeeAll && <td className={td}>{l.createdByName}</td>}
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {eligibleForMinutes &&
                      canManage &&
                      (l.addedToMeetingId ? (
                        <span className="text-xs text-stone-400">Added to minutes</span>
                      ) : (
                        <button
                          onClick={() => handleAddToMinutes(l.id)}
                          disabled={addingToMinutesId === l.id}
                          className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800 disabled:opacity-50"
                        >
                          {addingToMinutesId === l.id ? "Adding..." : "Add to Next Meeting Minutes"}
                        </button>
                      ))}
                    <a
                      href={`/api/letters/export/${l.id}`}
                      className="ml-3 text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                    >
                      Download
                    </a>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(l.id)}
                        className="ml-3 text-sm font-medium text-stone-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
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
