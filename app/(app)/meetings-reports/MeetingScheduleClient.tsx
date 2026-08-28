"use client";

import { useState } from "react";
import Link from "next/link";
import type { MeetingSchedule } from "@/app/generated/prisma/client";
import { DAY_NAMES, nextMeetingDate, nextOccurrence, todayIso } from "@/lib/meetings";
import { confirmDelete } from "@/lib/confirmDelete";

interface FormValues {
  label: string;
  dayOfWeek: string; // "" or "0".."6"
  intervalWeeks: string;
  anchorDate: string;
  time: string;
}

const EMPTY_FORM: FormValues = {
  label: "",
  dayOfWeek: "",
  intervalWeeks: "1",
  anchorDate: "",
  time: "",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function intervalLabel(weeks: number): string {
  if (weeks === 1) return "Weekly";
  if (weeks === 2) return "Every other week";
  return `Every ${weeks} weeks`;
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

export function MeetingScheduleClient({
  initialSchedules,
  canManage,
}: {
  initialSchedules: MeetingSchedule[];
  /** Vice President of Communications, Historian, or President — see lib/permissions.ts. */
  canManage: boolean;
}) {
  const [schedules, setSchedules] = useState<MeetingSchedule[]>(initialSchedules);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeSchedules = schedules.filter((s) => s.active);
  const upcoming = nextMeetingDate(activeSchedules, todayIso());

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (form.dayOfWeek === "") {
      setError("Day of week is required.");
      return;
    }
    if (!form.anchorDate) {
      setError("A date this series meets on is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: form.label,
        dayOfWeek: parseInt(form.dayOfWeek, 10),
        intervalWeeks: parseInt(form.intervalWeeks, 10) || 1,
        anchorDate: form.anchorDate,
        time: form.time,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      setError(await parseError(res));
      return;
    }

    const created: MeetingSchedule = await res.json();
    setSchedules((prev) => [...prev, created]);
    setForm(EMPTY_FORM);
    setShowAddForm(false);
  }

  async function toggleActive(schedule: MeetingSchedule) {
    const res = await fetch(`/api/meetings/${schedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !schedule.active }),
    });
    if (res.ok) {
      const updated: MeetingSchedule = await res.json();
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? updated : s)));
    } else {
      alert(await parseError(res));
    }
  }

  async function handleDelete(schedule: MeetingSchedule) {
    if (!confirmDelete(`Remove this meeting series${schedule.label ? ` ("${schedule.label}")` : ""}?`))
      return;
    setDeletingId(schedule.id);
    const res = await fetch(`/api/meetings/${schedule.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div>
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Next Meeting
        </p>
        <p className="mt-1 text-xl font-semibold text-stone-900">
          {upcoming ? formatDate(upcoming) : "No active meeting schedule set."}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {schedules.length} meeting series{schedules.length === 1 ? "" : ""}
        </p>
        {canManage && (
          <button
            onClick={() => {
              setShowAddForm((prev) => !prev);
              setError(null);
            }}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            {showAddForm ? "Cancel" : "New Meeting Series"}
          </button>
        )}
      </div>

      {canManage && showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div>
            <label className="block text-xs font-medium text-stone-600">Label</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. General Body"
              autoFocus
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Day of Week <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            >
              <option value="">— Select —</option>
              {DAY_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Every</label>
            <select
              value={form.intervalWeeks}
              onChange={(e) => setForm({ ...form, intervalWeeks: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {intervalLabel(n)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              A Date It Meets <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={form.anchorDate}
              onChange={(e) => setForm({ ...form, anchorDate: e.target.value })}
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Time</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-5">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create series"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Label", "Schedule", "Time", "Next Occurrence", "Active", ""].map((h) => (
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
            {schedules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  No meeting series yet. Create the first one above.
                </td>
              </tr>
            )}

            {schedules.map((schedule) => (
              <tr key={schedule.id} className={schedule.active ? "" : "opacity-50"}>
                <td className="px-4 py-2.5 font-medium text-stone-900">
                  {schedule.label || "—"}
                </td>
                <td className="px-4 py-2.5 text-stone-600">
                  {intervalLabel(schedule.intervalWeeks)} on {DAY_NAMES[schedule.dayOfWeek]}
                </td>
                <td className="px-4 py-2.5 text-stone-600">{schedule.time || "—"}</td>
                <td className="px-4 py-2.5 text-stone-600">
                  {formatDate(nextOccurrence(schedule, todayIso()))}
                </td>
                <td className="px-4 py-2.5">
                  {canManage ? (
                    <button
                      onClick={() => toggleActive(schedule)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        schedule.active
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      }`}
                    >
                      {schedule.active ? "Active" : "Paused"}
                    </button>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        schedule.active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {schedule.active ? "Active" : "Paused"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <Link
                    href={`/meetings-reports/${schedule.id}`}
                    className="text-sm font-medium text-rose-600 hover:text-rose-800"
                  >
                    Manage
                  </Link>
                  {canManage && (
                    <button
                      onClick={() => handleDelete(schedule)}
                      disabled={deletingId === schedule.id}
                      className="ml-3 text-sm font-medium text-stone-400 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === schedule.id ? "Removing..." : "Remove"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
