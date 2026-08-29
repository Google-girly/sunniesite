"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Meeting, MeetingSchedule } from "@/app/generated/prisma/client";
import { DAY_NAMES, formatTime12h, nextOccurrence, todayIso } from "@/lib/meetings";
import { formatMeetingDate } from "@/lib/meetingMinutes";
import { confirmDelete } from "@/lib/confirmDelete";

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

export function MeetingScheduleDetailClient({
  schedule,
  initialMeetings,
  canManage,
}: {
  schedule: MeetingSchedule;
  initialMeetings: Meeting[];
  /** Vice President of Communications, Historian, or President — see lib/permissions.ts. */
  canManage: boolean;
}) {
  const router = useRouter();
  const [meetings, setMeetings] = useState(initialMeetings);
  const [label, setLabel] = useState(schedule.label ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(String(schedule.dayOfWeek));
  const [intervalWeeks, setIntervalWeeks] = useState(String(schedule.intervalWeeks));
  const [anchorDate, setAnchorDate] = useState(schedule.anchorDate);
  const [endDate, setEndDate] = useState(schedule.endDate ?? "");
  const [time, setTime] = useState(schedule.time ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatedStatus, setGeneratedStatus] = useState<string | null>(null);
  const [loggingMeeting, setLoggingMeeting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    setGeneratedStatus(null);
    const res = await fetch(`/api/meetings/${schedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        dayOfWeek: parseInt(dayOfWeek, 10),
        intervalWeeks: parseInt(intervalWeeks, 10) || 1,
        anchorDate,
        endDate,
        time,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const updated: MeetingSchedule & { meetingsGenerated: number } = await res.json();
    setSaved(true);
    if (updated.meetingsGenerated > 0) {
      setGeneratedStatus(
        `${updated.meetingsGenerated} meeting${updated.meetingsGenerated === 1 ? "" : "s"} auto-generated through the end date.`
      );
      // Newly auto-generated rows live server-side only until re-fetched
      // — router.refresh() alone wouldn't reach this component's own
      // `meetings` state (useState only reads its initial value once).
      const meetingsRes = await fetch(`/api/meeting-minutes/meetings?scheduleId=${schedule.id}`);
      if (meetingsRes.ok) setMeetings(await meetingsRes.json());
    }
    router.refresh();
  }

  async function handleLogMeeting() {
    setLoggingMeeting(true);
    const nextDate = nextOccurrence(
      { ...schedule, dayOfWeek: parseInt(dayOfWeek, 10) || schedule.dayOfWeek, intervalWeeks: parseInt(intervalWeeks, 10) || schedule.intervalWeeks, anchorDate },
      todayIso()
    );
    const res = await fetch("/api/meeting-minutes/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: nextDate, time: time ? formatTime12h(time) : undefined, scheduleId: schedule.id }),
    });
    setLoggingMeeting(false);
    if (!res.ok) {
      alert(await parseError(res));
      return;
    }
    const created = await res.json();
    setMeetings((prev) => [created, ...prev]);
  }

  async function handleDeleteMeeting(id: string) {
    if (!confirmDelete("Remove this meeting and all its submitted reports?")) return;
    const res = await fetch(`/api/meeting-minutes/meetings/${id}`, { method: "DELETE" });
    if (res.ok) setMeetings((prev) => prev.filter((m) => m.id !== id));
    else alert(await parseError(res));
  }

  return (
    <div>
      <Link href="/meetings-reports" className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800">
        ← All Meeting Series
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-stone-900">{schedule.label || "Untitled Series"}</h1>
      <p className="mt-1 text-sm text-stone-500">
        Edit this series&apos; own recurring schedule, and see every real meeting (minutes record)
        logged against it.
      </p>

      {!canManage && (
        <p className="mt-4 text-sm text-stone-500">
          Read-only — only the Vice President of Communications, Historian, or President can edit
          meeting times or log/remove meetings.
        </p>
      )}

      <form
        onSubmit={handleSave}
        className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div>
          <label className="block text-xs font-medium text-stone-600">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={!canManage}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400 disabled:bg-stone-50 disabled:text-stone-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600">Day of Week</label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            disabled={!canManage}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400 disabled:bg-stone-50 disabled:text-stone-500"
          >
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
            value={intervalWeeks}
            onChange={(e) => setIntervalWeeks(e.target.value)}
            disabled={!canManage}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400 disabled:bg-stone-50 disabled:text-stone-500"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "Weekly" : n === 2 ? "Every other week" : `Every ${n} weeks`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600">A Date It Meets</label>
          <input
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            disabled={!canManage}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400 disabled:bg-stone-50 disabled:text-stone-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600">
            End Date <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={!canManage}
            min={anchorDate || undefined}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400 disabled:bg-stone-50 disabled:text-stone-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!canManage}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400 disabled:bg-stone-50 disabled:text-stone-500"
          />
        </div>
        {canManage && (
          <div className="sm:col-span-2 lg:col-span-6 flex items-center gap-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && !error && <p className="text-sm text-green-700">Saved.</p>}
            {generatedStatus && <p className="text-sm text-green-700">{generatedStatus}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </form>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-medium text-stone-900">Meetings from this series</h2>
        {canManage && (
          <button
            onClick={handleLogMeeting}
            disabled={loggingMeeting}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {loggingMeeting ? "Logging..." : "+ Log a Meeting"}
          </button>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Date", "Time", "Officer Reports", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {meetings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-400">
                  No meetings logged for this series yet.
                </td>
              </tr>
            )}
            {meetings.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5 font-medium text-stone-900">{formatMeetingDate(m.date)}</td>
                <td className="px-4 py-2.5 text-stone-600">{m.time || "—"}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <Link
                    href={`/meetings-reports/minutes/${m.id}`}
                    className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                  >
                    Open Minutes
                  </Link>
                  <a
                    href={`/api/meeting-minutes/export/${m.id}`}
                    className="ml-3 text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                  >
                    Export Minutes
                  </a>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteMeeting(m.id)}
                      className="ml-3 text-sm font-medium text-stone-400 hover:text-red-600"
                    >
                      Remove
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
