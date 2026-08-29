"use client";

import Link from "next/link";
import { useState } from "react";
import type { MakeUpProject, Member, ServiceHourEntry } from "@/app/generated/prisma/client";
import {
  ANNUAL_HOURS_REQUIRED,
  calculateServiceTotals,
  currentTerm,
  formatServiceDate,
  isServiceCategory,
  PHILANTHROPY_HOURS_REQUIRED,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  SURVIVOR_SUPPORT_HOURS_REQUIRED,
  type ServiceCategory,
} from "@/lib/communityService";
import { todayIso } from "@/lib/meetings";
import { confirmDelete } from "@/lib/confirmDelete";

type MemberWithService = Member & {
  serviceHours: ServiceHourEntry[];
  makeUpProjects: MakeUpProject[];
};

interface EntryFormValues {
  date: string;
  event: string;
  description: string;
  hours: string;
  category: ServiceCategory | "";
  volunteerContact: string;
}

function emptyEntryForm(): EntryFormValues {
  return {
    date: todayIso(),
    event: "",
    description: "",
    hours: "",
    category: "",
    volunteerContact: "",
  };
}

function entryToForm(entry: ServiceHourEntry): EntryFormValues {
  return {
    date: entry.date,
    event: entry.event,
    description: entry.description ?? "",
    hours: String(entry.hours),
    category: isServiceCategory(entry.category) ? entry.category : "GENERAL",
    volunteerContact: entry.volunteerContact ?? "",
  };
}

interface MakeUpFormValues {
  term: string;
  hoursUncompleted: string;
  project: string;
  dueDate: string;
  completed: boolean;
  libraryHoursCompleted: boolean;
}

function emptyMakeUpForm(): MakeUpFormValues {
  return {
    term: currentTerm(),
    hoursUncompleted: "",
    project: "",
    dueDate: "",
    completed: false,
    libraryHoursCompleted: false,
  };
}

function makeUpToForm(m: MakeUpProject): MakeUpFormValues {
  return {
    term: m.term,
    hoursUncompleted: String(m.hoursUncompleted),
    project: m.project ?? "",
    dueDate: m.dueDate ?? "",
    completed: m.completed,
    libraryHoursCompleted: m.libraryHoursCompleted,
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
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600">
          Event <span className="text-burgundy-500">*</span>
        </label>
        <input
          value={form.event}
          onChange={(e) => setForm({ ...form, event: e.target.value })}
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
          Category <span className="text-burgundy-500">*</span>
        </label>
        <select
          required
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value as ServiceCategory })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        >
          <option value="">— Select —</option>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SERVICE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600">
          Description <span className="text-burgundy-500">*</span>
        </label>
        <input
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600">
          Volunteer Contact <span className="text-burgundy-500">*</span>
        </label>
        <input
          required
          value={form.volunteerContact}
          onChange={(e) => setForm({ ...form, volunteerContact: e.target.value })}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
      </div>
    </>
  );
}

export function MemberServiceClient({ member }: { member: MemberWithService }) {
  const [entries, setEntries] = useState<ServiceHourEntry[]>(member.serviceHours);
  const [makeUpProjects, setMakeUpProjects] = useState<MakeUpProject[]>(member.makeUpProjects);

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addForm, setAddForm] = useState<EntryFormValues>(emptyEntryForm());
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryFormValues>(emptyEntryForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showAddMakeUp, setShowAddMakeUp] = useState(false);
  const [addMakeUpForm, setAddMakeUpForm] = useState<MakeUpFormValues>(emptyMakeUpForm());
  const [addMakeUpError, setAddMakeUpError] = useState<string | null>(null);
  const [addingMakeUp, setAddingMakeUp] = useState(false);
  const [editingMakeUpId, setEditingMakeUpId] = useState<string | null>(null);
  const [editMakeUpForm, setEditMakeUpForm] = useState<MakeUpFormValues>(emptyMakeUpForm());
  const [savingMakeUpEdit, setSavingMakeUpEdit] = useState(false);
  const [deletingMakeUpId, setDeletingMakeUpId] = useState<string | null>(null);

  const totals = calculateServiceTotals(entries);

  function sortByDate(list: ServiceHourEntry[]): ServiceHourEntry[] {
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }

  function validateEntry(form: EntryFormValues): string | null {
    if (!form.date) return "Date is required.";
    if (!form.event.trim()) return "Event is required.";
    const hours = parseFloat(form.hours);
    if (!Number.isFinite(hours) || hours <= 0) return "Hours must be greater than zero.";
    if (!form.category) return "Category is required.";
    if (!form.description.trim()) return "Description is required.";
    if (!form.volunteerContact.trim()) return "Volunteer Contact is required.";
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

    const res = await fetch("/api/community-service/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: member.id,
        date: addForm.date,
        event: addForm.event.trim(),
        description: addForm.description.trim(),
        hours: parseFloat(addForm.hours),
        category: addForm.category,
        volunteerContact: addForm.volunteerContact.trim(),
      }),
    });

    setAdding(false);
    if (!res.ok) {
      setAddError(await parseError(res));
      return;
    }
    const created: ServiceHourEntry = await res.json();
    setEntries((prev) => sortByDate([...prev, created]));
    setAddForm(emptyEntryForm());
    setShowAddEntry(false);
  }

  function startEdit(entry: ServiceHourEntry) {
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

    const res = await fetch(`/api/community-service/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: editForm.date,
        event: editForm.event.trim(),
        description: editForm.description.trim(),
        hours: parseFloat(editForm.hours),
        category: editForm.category,
        volunteerContact: editForm.volunteerContact.trim(),
      }),
    });

    setSavingEdit(false);
    if (!res.ok) {
      setEditError(await parseError(res));
      return;
    }
    const updated: ServiceHourEntry = await res.json();
    setEntries((prev) => sortByDate(prev.map((e) => (e.id === id ? updated : e))));
    setEditingId(null);
  }

  async function handleDeleteEntry(entry: ServiceHourEntry) {
    if (!confirmDelete(`Remove this entry (${entry.event})?`)) return;
    setDeletingId(entry.id);
    const res = await fetch(`/api/community-service/entries/${entry.id}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } else {
      alert(await parseError(res));
    }
  }

  function validateMakeUp(form: MakeUpFormValues): string | null {
    if (!form.term.trim()) return "Term is required.";
    const hours = parseFloat(form.hoursUncompleted);
    if (!Number.isFinite(hours) || hours <= 0)
      return "Hours uncompleted must be greater than zero.";
    return null;
  }

  async function handleAddMakeUp(e: React.FormEvent) {
    e.preventDefault();
    const err = validateMakeUp(addMakeUpForm);
    if (err) {
      setAddMakeUpError(err);
      return;
    }
    setAddingMakeUp(true);
    setAddMakeUpError(null);

    const res = await fetch("/api/community-service/makeup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: member.id,
        term: addMakeUpForm.term.trim(),
        hoursUncompleted: parseFloat(addMakeUpForm.hoursUncompleted),
        project: addMakeUpForm.project.trim() || undefined,
        dueDate: addMakeUpForm.dueDate || undefined,
        completed: addMakeUpForm.completed,
        libraryHoursCompleted: addMakeUpForm.libraryHoursCompleted,
      }),
    });

    setAddingMakeUp(false);
    if (!res.ok) {
      setAddMakeUpError(await parseError(res));
      return;
    }
    const created: MakeUpProject = await res.json();
    setMakeUpProjects((prev) => [created, ...prev]);
    setAddMakeUpForm(emptyMakeUpForm());
    setShowAddMakeUp(false);
  }

  function startEditMakeUp(m: MakeUpProject) {
    setEditingMakeUpId(m.id);
    setEditMakeUpForm(makeUpToForm(m));
  }

  async function handleSaveMakeUpEdit(id: string) {
    const err = validateMakeUp(editMakeUpForm);
    if (err) {
      alert(err);
      return;
    }
    setSavingMakeUpEdit(true);
    const res = await fetch(`/api/community-service/makeup/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: editMakeUpForm.term.trim(),
        hoursUncompleted: parseFloat(editMakeUpForm.hoursUncompleted),
        project: editMakeUpForm.project.trim() || null,
        dueDate: editMakeUpForm.dueDate || null,
        completed: editMakeUpForm.completed,
        libraryHoursCompleted: editMakeUpForm.libraryHoursCompleted,
      }),
    });
    setSavingMakeUpEdit(false);
    if (!res.ok) {
      alert(await parseError(res));
      return;
    }
    const updated: MakeUpProject = await res.json();
    setMakeUpProjects((prev) => prev.map((m) => (m.id === id ? updated : m)));
    setEditingMakeUpId(null);
  }

  async function handleDeleteMakeUp(m: MakeUpProject) {
    if (!confirmDelete(`Remove this make-up project (${m.term})?`)) return;
    setDeletingMakeUpId(m.id);
    const res = await fetch(`/api/community-service/makeup/${m.id}`, { method: "DELETE" });
    setDeletingMakeUpId(null);
    if (res.ok) {
      setMakeUpProjects((prev) => prev.filter((p) => p.id !== m.id));
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div>
      <Link
        href="/community-service"
        className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
      >
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
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-stone-200 bg-white px-5 py-3 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Total</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">
              {totals.total}/{ANNUAL_HOURS_REQUIRED}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Philanthropy
            </p>
            <p className="mt-1 text-lg font-semibold text-stone-900">
              {totals.philanthropy}/{PHILANTHROPY_HOURS_REQUIRED}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Sexual Assault Awareness
            </p>
            <p className="mt-1 text-lg font-semibold text-stone-900">
              {totals.survivorSupport}/{SURVIVOR_SUPPORT_HOURS_REQUIRED}
            </p>
          </div>
        </div>
      </div>

      {/* Hour log */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {entries.length} logged entr{entries.length === 1 ? "y" : "ies"}
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
              {["Date", "Event", "Category", "Description", "Hours", "Contact", ""].map((h) => (
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
                    {formatServiceDate(entry.date)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-900">{entry.event}</td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {SERVICE_CATEGORY_LABELS[
                      isServiceCategory(entry.category) ? entry.category : "GENERAL"
                    ]}
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{entry.description || "—"}</td>
                  <td className="px-4 py-2.5 font-medium text-stone-900">{entry.hours}</td>
                  <td className="px-4 py-2.5 text-stone-500">
                    {entry.volunteerContact || "—"}
                  </td>
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

      {/* Make-Up Projects */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">Community Service Make-Up</h2>
        <button
          onClick={() => {
            setShowAddMakeUp((prev) => !prev);
            setAddMakeUpForm(emptyMakeUpForm());
            setAddMakeUpError(null);
          }}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          {showAddMakeUp ? "Cancel" : "Add Make-Up Project"}
        </button>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        For a term this member fell short of the hour requirement — Chapter
        Standing Rules Article VIII §B.
      </p>

      {showAddMakeUp && (
        <form
          onSubmit={handleAddMakeUp}
          className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Term <span className="text-burgundy-500">*</span>
            </label>
            <input
              value={addMakeUpForm.term}
              onChange={(e) => setAddMakeUpForm({ ...addMakeUpForm, term: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Hours Uncompleted <span className="text-burgundy-500">*</span>
            </label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={addMakeUpForm.hoursUncompleted}
              onChange={(e) =>
                setAddMakeUpForm({ ...addMakeUpForm, hoursUncompleted: e.target.value })
              }
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Due Date</label>
            <input
              type="date"
              value={addMakeUpForm.dueDate}
              onChange={(e) => setAddMakeUpForm({ ...addMakeUpForm, dueDate: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-stone-600">
              Make-Up Project <span className="text-stone-400">(optional)</span>
            </label>
            <input
              value={addMakeUpForm.project}
              onChange={(e) => setAddMakeUpForm({ ...addMakeUpForm, project: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={addMakeUpForm.completed}
              onChange={(e) =>
                setAddMakeUpForm({ ...addMakeUpForm, completed: e.target.checked })
              }
              className="h-4 w-4 rounded border-stone-300 text-burgundy-600 focus:ring-burgundy-400"
            />
            Completed
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={addMakeUpForm.libraryHoursCompleted}
              onChange={(e) =>
                setAddMakeUpForm({
                  ...addMakeUpForm,
                  libraryHoursCompleted: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-stone-300 text-burgundy-600 focus:ring-burgundy-400"
            />
            Library Hours Completed
          </label>

          <div className="sm:col-span-2 lg:col-span-3">
            {addMakeUpError && <p className="mb-2 text-sm text-red-600">{addMakeUpError}</p>}
            <button
              type="submit"
              disabled={addingMakeUp}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
            >
              {addingMakeUp ? "Saving..." : "Add make-up project"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {[
                "Term",
                "Hours Uncompleted",
                "Project",
                "Due Date",
                "Completed?",
                "Library Hours?",
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
            {makeUpProjects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                  No make-up projects on file.
                </td>
              </tr>
            )}
            {makeUpProjects.map((m) => {
              const isEditing = editingMakeUpId === m.id;
              if (isEditing) {
                return (
                  <tr key={m.id} className="bg-burgundy-50/40">
                    <td className="px-4 py-2">
                      <input
                        value={editMakeUpForm.term}
                        onChange={(e) =>
                          setEditMakeUpForm({ ...editMakeUpForm, term: e.target.value })
                        }
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.25"
                        value={editMakeUpForm.hoursUncompleted}
                        onChange={(e) =>
                          setEditMakeUpForm({
                            ...editMakeUpForm,
                            hoursUncompleted: e.target.value,
                          })
                        }
                        className="w-24 rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editMakeUpForm.project}
                        onChange={(e) =>
                          setEditMakeUpForm({ ...editMakeUpForm, project: e.target.value })
                        }
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={editMakeUpForm.dueDate}
                        onChange={(e) =>
                          setEditMakeUpForm({ ...editMakeUpForm, dueDate: e.target.value })
                        }
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={editMakeUpForm.completed}
                        onChange={(e) =>
                          setEditMakeUpForm({ ...editMakeUpForm, completed: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-stone-300 text-burgundy-600 focus:ring-burgundy-400"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={editMakeUpForm.libraryHoursCompleted}
                        onChange={(e) =>
                          setEditMakeUpForm({
                            ...editMakeUpForm,
                            libraryHoursCompleted: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-stone-300 text-burgundy-600 focus:ring-burgundy-400"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleSaveMakeUpEdit(m.id)}
                        disabled={savingMakeUpEdit}
                        className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800 disabled:opacity-50"
                      >
                        {savingMakeUpEdit ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingMakeUpId(null)}
                        className="ml-3 text-sm font-medium text-stone-500 hover:text-stone-700"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 text-stone-900">{m.term}</td>
                  <td className="px-4 py-2.5 text-stone-600">{m.hoursUncompleted}</td>
                  <td className="px-4 py-2.5 text-stone-600">{m.project || "—"}</td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {formatServiceDate(m.dueDate)}
                  </td>
                  <td className="px-4 py-2.5">{m.completed ? "Yes" : "No"}</td>
                  <td className="px-4 py-2.5">{m.libraryHoursCompleted ? "Yes" : "No"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <button
                      onClick={() => startEditMakeUp(m)}
                      className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteMakeUp(m)}
                      disabled={deletingMakeUpId === m.id}
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
