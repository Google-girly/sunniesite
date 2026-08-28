"use client";

import Link from "next/link";
import { useState } from "react";
import type { Member, StudyHourEntry } from "@/app/generated/prisma/client";
import {
  calculateWeeklyCompletion,
  currentTermRange,
  formatStudyDate,
  totalHours,
  weekOfMonth,
  WEEKLY_HOURS_REQUIRED,
} from "@/lib/studyHours";
import { todayIso } from "@/lib/meetings";
import { confirmDelete } from "@/lib/confirmDelete";

type MemberWithStudyHours = Member & { studyHours: StudyHourEntry[] };

interface EntryFormValues {
  date: string;
  location: string;
  hours: string;
  timeIn: string;
  timeOut: string;
}

function emptyEntryForm(): EntryFormValues {
  return { date: todayIso(), location: "", hours: "", timeIn: "", timeOut: "" };
}

function entryToForm(entry: StudyHourEntry): EntryFormValues {
  return {
    date: entry.date,
    location: entry.location,
    hours: String(entry.hours),
    timeIn: entry.timeIn ?? "",
    timeOut: entry.timeOut ?? "",
  };
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

function EntryFields({
  form,
  setForm,
}: {
  form: EntryFormValues;
  setForm: (form: EntryFormValues) => void;
}) {
  return (
    <>
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
        {form.date && <p className="mt-1 text-xs text-stone-400">Week {weekOfMonth(form.date)} of the month</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600">
          Study Location <span className="text-burgundy-500">*</span>
        </label>
        <input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="Library, Home, ..."
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600">
          Hours <span className="text-burgundy-500">*</span>
        </label>
        <input
          type="number"
          step="0.25"
          min="0.25"
          value={form.hours}
          onChange={(e) => setForm({ ...form, hours: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600">
          Time In <span className="text-burgundy-500">*</span>
        </label>
        <input
          type="time"
          required
          value={form.timeIn}
          onChange={(e) => setForm({ ...form, timeIn: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600">
          Time Out <span className="text-burgundy-500">*</span>
        </label>
        <input
          type="time"
          required
          value={form.timeOut}
          onChange={(e) => setForm({ ...form, timeOut: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>
    </>
  );
}

export function MemberStudyHoursClient({ member }: { member: MemberWithStudyHours }) {
  const [entries, setEntries] = useState<StudyHourEntry[]>(member.studyHours);

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addForm, setAddForm] = useState<EntryFormValues>(emptyEntryForm());
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryFormValues>(emptyEntryForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const term = currentTermRange();
  const completion = calculateWeeklyCompletion(entries, term.start, term.end);
  const total = totalHours(entries);

  function sortByDate(list: StudyHourEntry[]): StudyHourEntry[] {
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }

  function validateEntry(form: EntryFormValues): string | null {
    if (!form.date) return "Date is required.";
    if (!form.location.trim()) return "Study location is required.";
    const hours = parseFloat(form.hours);
    if (!Number.isFinite(hours) || hours <= 0) return "Hours must be greater than zero.";
    if (!form.timeIn) return "Time In is required.";
    if (!form.timeOut) return "Time Out is required.";
    return null;
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    const err = validateEntry(addForm);
    if (err) {
      setAddError(err);
      return;
    }
    setAdding(true);
    setAddError(null);

    const res = await fetch("/api/study-hours/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: member.id,
        date: addForm.date,
        location: addForm.location.trim(),
        hours: parseFloat(addForm.hours),
        timeIn: addForm.timeIn,
        timeOut: addForm.timeOut,
      }),
    });

    setAdding(false);
    if (!res.ok) {
      setAddError(await parseError(res));
      return;
    }
    const created: StudyHourEntry = await res.json();
    setEntries((prev) => sortByDate([...prev, created]));
    setAddForm(emptyEntryForm());
    setShowAddEntry(false);
  }

  function startEdit(entry: StudyHourEntry) {
    setEditingId(entry.id);
    setEditForm(entryToForm(entry));
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    const err = validateEntry(editForm);
    if (err) {
      setEditError(err);
      return;
    }
    setSavingEdit(true);
    setEditError(null);

    const res = await fetch(`/api/study-hours/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: editForm.date,
        location: editForm.location.trim(),
        hours: parseFloat(editForm.hours),
        timeIn: editForm.timeIn,
        timeOut: editForm.timeOut,
      }),
    });

    setSavingEdit(false);
    if (!res.ok) {
      setEditError(await parseError(res));
      return;
    }
    const updated: StudyHourEntry = await res.json();
    setEntries((prev) => sortByDate(prev.map((e) => (e.id === id ? updated : e))));
    setEditingId(null);
  }

  async function handleDeleteEntry(entry: StudyHourEntry) {
    if (!confirmDelete(`Remove this entry (${entry.location}, ${entry.date})?`)) return;
    setDeletingId(entry.id);
    const res = await fetch(`/api/study-hours/entries/${entry.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div>
      <Link href="/study-hours" className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800">
        ← All Members
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{member.name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {member.nickname ? `"${member.nickname}" · ` : ""}
            {member.class ? `${member.class} Class` : "No class on file"}
            {member.crossingNumber != null ? `, #${member.crossingNumber}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-stone-200 bg-white px-5 py-3 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Weeks Completed
            </p>
            <p className="mt-1 text-lg font-semibold text-stone-900">
              {completion.weeksCompleted}/{completion.weeksInTerm} ({completion.percentage}%)
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Total Hours
            </p>
            <p className="mt-1 text-lg font-semibold text-stone-900">{total}</p>
          </div>
        </div>
      </div>
      <p className="mt-1 text-xs text-stone-400">
        {WEEKLY_HOURS_REQUIRED} hours/week required, current term ({term.start} – {term.end}).
      </p>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {entries.length} logged session{entries.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => {
            setShowAddEntry((prev) => !prev);
            setAddForm(emptyEntryForm());
            setAddError(null);
          }}
          className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700"
        >
          {showAddEntry ? "Cancel" : "Log Hours"}
        </button>
      </div>

      {showAddEntry && (
        <form
          onSubmit={handleAddEntry}
          className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <EntryFields form={addForm} setForm={setAddForm} />
          <div className="sm:col-span-2 lg:col-span-3">
            {addError && <p className="mb-2 text-sm text-red-600">{addError}</p>}
            <button
              type="submit"
              disabled={adding}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
            >
              {adding ? "Saving..." : "Add entry"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Date", "Week", "Location", "Time In", "Time Out", "Hours", ""].map((h) => (
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
                <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                  No hours logged yet.
                </td>
              </tr>
            )}
            {entries.map((entry) => {
              const isEditing = editingId === entry.id;
              if (isEditing) {
                return (
                  <tr key={entry.id}>
                    <td colSpan={7} className="bg-burgundy-50/40 px-4 py-4">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveEdit(entry.id);
                        }}
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                      >
                        <EntryFields form={editForm} setForm={setEditForm} />
                        <div className="sm:col-span-2 lg:col-span-3">
                          {editError && <p className="mb-2 text-sm text-red-600">{editError}</p>}
                          <div className="flex gap-3">
                            <button
                              type="submit"
                              disabled={savingEdit}
                              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
                            >
                              {savingEdit ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-md px-4 py-2 text-sm font-medium text-stone-500 hover:text-stone-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={entry.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-stone-600">
                    {formatStudyDate(entry.date)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-stone-500">
                    Week {weekOfMonth(entry.date)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-900">{entry.location}</td>
                  <td className="px-4 py-2.5 text-stone-500">{entry.timeIn || "—"}</td>
                  <td className="px-4 py-2.5 text-stone-500">{entry.timeOut || "—"}</td>
                  <td className="px-4 py-2.5 font-medium text-stone-900">{entry.hours}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <button
                      onClick={() => startEdit(entry)}
                      className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry)}
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
