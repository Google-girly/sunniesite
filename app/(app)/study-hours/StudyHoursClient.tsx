"use client";

import Link from "next/link";
import { useState } from "react";
import type { Member, StudyHourEntry } from "@/app/generated/prisma/client";
import {
  calculateWeeklyCompletion,
  currentTermRange,
  totalHours,
  weekOfMonth,
  WEEKLY_COMPLETION_THRESHOLD,
} from "@/lib/studyHours";
import { todayIso } from "@/lib/meetings";

type MemberWithStudyHours = Member & { studyHours: StudyHourEntry[] };

interface LogHoursForm {
  memberId: string;
  date: string;
  location: string;
  timeIn: string;
  timeOut: string;
  hours: string;
}

function emptyLogForm(defaultMemberId: string): LogHoursForm {
  return {
    memberId: defaultMemberId,
    date: todayIso(),
    location: "",
    timeIn: "",
    timeOut: "",
    hours: "",
  };
}

function sortByName(members: MemberWithStudyHours[]): MemberWithStudyHours[] {
  return [...members].sort((a, b) => a.name.localeCompare(b.name));
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

function ProgressBar({ value, required }: { value: number; required: number }) {
  const pct = required > 0 ? Math.min(100, (value / required) * 100) : 0;
  const met = required > 0 && value >= required;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full ${met ? "bg-green-500" : "bg-burgundy-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-xs text-stone-500">
        {value}/{required} wks
      </span>
    </div>
  );
}

export function StudyHoursClient({
  initialMembers,
  canExport,
}: {
  initialMembers: MemberWithStudyHours[];
  canExport: boolean;
}) {
  const [members, setMembers] = useState<MemberWithStudyHours[]>(sortByName(initialMembers));

  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState<LogHoursForm>(emptyLogForm(initialMembers[0]?.id ?? ""));
  const [logError, setLogError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  const term = currentTermRange();
  const withCompletion = members.map((m) => ({
    member: m,
    completion: calculateWeeklyCompletion(m.studyHours, term.start, term.end),
    total: totalHours(m.studyHours),
  }));

  const metCount = withCompletion.filter(
    (m) => m.completion.percentage >= WEEKLY_COMPLETION_THRESHOLD * 100
  ).length;

  async function handleLogHours(e: React.FormEvent) {
    e.preventDefault();
    if (!logForm.memberId) {
      setLogError("Pick who this is for.");
      return;
    }
    if (!logForm.location.trim()) {
      setLogError("Study location is required.");
      return;
    }
    const hours = parseFloat(logForm.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setLogError("Hours must be greater than zero.");
      return;
    }
    if (!logForm.timeIn) {
      setLogError("Time In is required.");
      return;
    }
    if (!logForm.timeOut) {
      setLogError("Time Out is required.");
      return;
    }
    setLogging(true);
    setLogError(null);

    const res = await fetch("/api/study-hours/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: logForm.memberId,
        date: logForm.date,
        location: logForm.location.trim(),
        hours,
        timeIn: logForm.timeIn,
        timeOut: logForm.timeOut,
      }),
    });

    setLogging(false);
    if (!res.ok) {
      setLogError(await parseError(res));
      return;
    }

    const created: StudyHourEntry = await res.json();
    setMembers((prev) =>
      prev.map((m) =>
        m.id === logForm.memberId ? { ...m, studyHours: [...m.studyHours, created] } : m
      )
    );
    setLogForm(emptyLogForm(logForm.memberId));
    setShowLogForm(false);
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            On Track This Term (80%+)
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {metCount} / {members.length}
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 rounded-lg border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            onClick={() => {
              setShowLogForm((prev) => !prev);
              setLogError(null);
            }}
            className="rounded-md bg-burgundy-600 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-burgundy-700"
          >
            {showLogForm ? "Cancel" : "Log Hours"}
          </button>
          {canExport && (
            <>
              <a
                href="/api/study-hours/export"
                className="rounded-md border border-stone-300 px-3 py-1.5 text-center text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Export Hour Logs
              </a>
              <a
                href="/api/study-hours/export/report"
                className="rounded-md border border-stone-300 px-3 py-1.5 text-center text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Export Chapter Standards Report
              </a>
            </>
          )}
        </div>
      </div>

      {showLogForm && (
        <form
          onSubmit={handleLogHours}
          className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Who <span className="text-burgundy-500">*</span>
            </label>
            <select
              value={logForm.memberId}
              onChange={(e) => setLogForm({ ...logForm, memberId: e.target.value })}
              autoFocus
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Date <span className="text-burgundy-500">*</span>
            </label>
            <input
              type="date"
              value={logForm.date}
              onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
            {logForm.date && (
              <p className="mt-1 text-xs text-stone-400">Week {weekOfMonth(logForm.date)} of the month</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Study Location <span className="text-burgundy-500">*</span>
            </label>
            <input
              value={logForm.location}
              onChange={(e) => setLogForm({ ...logForm, location: e.target.value })}
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
              value={logForm.hours}
              onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })}
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
              value={logForm.timeIn}
              onChange={(e) => setLogForm({ ...logForm, timeIn: e.target.value })}
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
              value={logForm.timeOut}
              onChange={(e) => setLogForm({ ...logForm, timeOut: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            {logError && <p className="mb-2 text-sm text-red-600">{logError}</p>}
            <button
              type="submit"
              disabled={logging}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
            >
              {logging ? "Saving..." : "Add entry"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Name", "Status", "Weekly Completion", "Total Hours", ""].map((h) => (
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
            {withCompletion.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  No Active/Inactive members on the roster yet.
                </td>
              </tr>
            )}

            {withCompletion.map(({ member, completion, total }) => (
              <tr key={member.id}>
                <td className="px-4 py-2.5 font-medium text-stone-900">{member.name}</td>
                <td className="px-4 py-2.5">
                  {completion.percentage >= WEEKLY_COMPLETION_THRESHOLD * 100 ? (
                    <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      On Track
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                      Behind
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <ProgressBar value={completion.weeksCompleted} required={completion.weeksInTerm} />
                </td>
                <td className="px-4 py-2.5 text-stone-700">{total}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <Link
                    href={`/study-hours/${member.id}`}
                    className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                  >
                    View Log
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
