"use client";

import Link from "next/link";
import { useState } from "react";
import type { Meeting, MeetingSchedule, OfficerReport } from "@/app/generated/prisma/client";
import { formatMeetingDate, OFFICER_POSITIONS } from "@/lib/meetingMinutes";
import { formatTime12h, nextOccurrence, todayIso } from "@/lib/meetings";
import { confirmDelete } from "@/lib/confirmDelete";

type MeetingWithReports = Meeting & { officerReports: OfficerReport[] };

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

// The soonest upcoming occurrence across every active schedule, plus
// that specific schedule's own established time — "the general meeting
// times we established," so a new Meeting record defaults to matching
// them instead of requiring the date/time to be typed in by hand each
// time (still fully editable below).
function nextScheduledMeeting(
  schedules: MeetingSchedule[],
  fromIso: string
): { date: string; time: string; scheduleId: string } {
  if (schedules.length === 0) return { date: fromIso, time: "", scheduleId: "" };
  const withDates = schedules.map((s) => ({ schedule: s, date: nextOccurrence(s, fromIso) }));
  withDates.sort((a, b) => a.date.localeCompare(b.date));
  const soonest = withDates[0];
  return {
    date: soonest.date,
    time: soonest.schedule.time ? formatTime12h(soonest.schedule.time) : "",
    scheduleId: soonest.schedule.id,
  };
}

export function MinutesListClient({
  initialMeetings,
  schedules,
}: {
  initialMeetings: MeetingWithReports[];
  schedules: MeetingSchedule[];
}) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [showAdd, setShowAdd] = useState(false);
  const defaults = nextScheduledMeeting(schedules, todayIso());
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [scheduleId, setScheduleId] = useState(defaults.scheduleId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/meeting-minutes/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time: time.trim() || undefined, scheduleId: scheduleId || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    setMeetings((prev) => [created, ...prev]);
    setDate(defaults.date);
    setTime(defaults.time);
    setScheduleId(defaults.scheduleId);
    setShowAdd(false);
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this meeting and all its submitted reports?")) return;
    const res = await fetch(`/api/meeting-minutes/meetings/${id}`, { method: "DELETE" });
    if (res.ok) setMeetings((prev) => prev.filter((m) => m.id !== id));
    else alert(await parseError(res));
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          {showAdd ? "Cancel" : "New Meeting"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2"
        >
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Time <span className="text-stone-400">(optional, e.g. 6:00 PM)</span>
            </label>
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="6:00 PM"
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Part of Series <span className="text-stone-400">(optional)</span>
            </label>
            <select
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            >
              <option value="">— One-off, not part of a series —</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label || "Untitled series"}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Date", "Time", "Reports Submitted", ""].map((h) => (
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
            {meetings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-400">
                  No meetings yet.
                </td>
              </tr>
            )}
            {meetings.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5 font-medium text-stone-900">
                  {formatMeetingDate(m.date)}
                </td>
                <td className="px-4 py-2.5 text-stone-600">{m.time || "—"}</td>
                <td className="px-4 py-2.5 text-stone-600">
                  {m.officerReports.length} / {OFFICER_POSITIONS.length}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <Link
                    href={`/meetings-reports/minutes/${m.id}`}
                    className="text-sm font-medium text-rose-600 hover:text-rose-800"
                  >
                    Open
                  </Link>
                  <a
                    href={`/api/meeting-minutes/export/${m.id}`}
                    className="ml-3 text-sm font-medium text-rose-600 hover:text-rose-800"
                  >
                    Export
                  </a>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="ml-3 text-sm font-medium text-stone-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
