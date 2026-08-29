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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingToMinutesId, setAddingToMinutesId] = useState<string | null>(null);
  const [minutesError, setMinutesError] = useState<string | null>(null);

  // Matches app/api/letters/[id]/route.ts canManage — a draft is
  // isolated to its creator even from the President.
  function canManage(l: Letter): boolean {
    if (l.createdByMemberId === viewerId) return true;
    if (l.isDraft) return false;
    return canSeeAll;
  }

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
    // Aug 2026 — this is also how a draft publishes (isDraft flips to
    // false server-side too — see the route), so this row now shows up
    // for everyone under the normal own/President rules.
    setLetters((prev) => prev.map((l) => (l.id === id ? { ...l, addedToMeetingId: meetingId, isDraft: false } : l)));
  }

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Aug 2026 — "make the letterhead be able to have drafts as well." A
  // draft only needs a type picked (see lib/letters.ts parseLetterInput);
  // the normal Create/Save button still requires everything.
  const draftFilled = Boolean(form.type) && (form.type !== "Other" || form.typeOther.trim() !== "");

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowAdd(true);
  }

  function startEdit(l: Letter) {
    setEditingId(l.id);
    setForm({
      type: (LETTER_TYPES as readonly string[]).includes(l.type) ? (l.type as LetterType) : "Other",
      typeOther: l.type === "Other" ? l.typeOther ?? "" : "",
      recipientName: l.recipientName ?? "",
      date: l.date || todayIso(),
      purpose: l.purpose,
    });
    setError(null);
    setShowAdd(true);
  }

  function cancelForm() {
    setShowAdd(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit(e: { preventDefault: () => void }, isDraft: boolean = false) {
    e.preventDefault();
    if (!isDraft && !form.purpose.trim()) {
      setError("Purpose / letter body is required.");
      return;
    }
    if (form.type === "Other" && !form.typeOther.trim()) {
      setError("Enter what kind of letter this is.");
      return;
    }
    setSaving(true);
    setError(null);
    const url = editingId ? `/api/letters/${editingId}` : "/api/letters";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        typeOther: form.typeOther || undefined,
        isDraft,
        recipientName: form.recipientName || undefined,
        date: form.date || undefined,
        purpose: form.purpose || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const saved: Letter = await res.json();
    setLetters((prev) => (editingId ? prev.map((l) => (l.id === editingId ? saved : l)) : [saved, ...prev]));
    cancelForm();
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
          onClick={() => (showAdd ? cancelForm() : startAdd())}
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
          <p className="sm:col-span-2 text-sm font-semibold text-stone-800">
            {editingId ? "Edit Letter" : "New Letter"}
          </p>
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
            <label className={labelClass}>Date</label>
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
            <label className={labelClass}>Purpose / Letter Body</label>
            <textarea
              value={form.purpose}
              onChange={(e) => update("purpose", e.target.value)}
              rows={5}
              placeholder="What this letter is for — this becomes the letter's body text."
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            {error && <p className="mb-2 w-full text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Letter"}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={saving || !draftFilled}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Save with just the Type picked — finish the rest later. Only you can see a draft until you finish it or add it to a meeting's minutes."
            >
              {saving ? "Saving..." : "Save as Draft"}
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
              const manageable = canManage(l);
              const eligibleForMinutes = ADD_TO_MINUTES_TYPES.includes(l.type);
              return (
                <tr key={l.id}>
                  <td className={`${td} font-medium text-stone-900`}>{l.date || "—"}</td>
                  <td className={td}>
                    {letterTitle(l)}
                    {l.isDraft && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className={`${td} max-w-sm truncate`} title={l.purpose}>
                    {l.purpose || "—"}
                  </td>
                  {canSeeAll && <td className={td}>{l.createdByName}</td>}
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {eligibleForMinutes &&
                      manageable &&
                      (l.addedToMeetingId ? (
                        <span className="text-xs text-stone-400">Added to minutes</span>
                      ) : (
                        <button
                          onClick={() => handleAddToMinutes(l.id)}
                          disabled={addingToMinutesId === l.id || !l.purpose.trim()}
                          title={!l.purpose.trim() ? "Fill in the letter body first." : undefined}
                          className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {addingToMinutesId === l.id ? "Adding..." : "Add to Next Meeting Minutes"}
                        </button>
                      ))}
                    {l.isDraft ? (
                      <span className="ml-3 text-sm text-stone-400" title="Finish or add to a meeting's minutes before exporting.">
                        Download
                      </span>
                    ) : (
                      <a
                        href={`/api/letters/export/${l.id}`}
                        className="ml-3 text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                      >
                        Download
                      </a>
                    )}
                    {manageable && (
                      <button
                        onClick={() => startEdit(l)}
                        className="ml-3 text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                      >
                        Edit
                      </button>
                    )}
                    {manageable && (
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
