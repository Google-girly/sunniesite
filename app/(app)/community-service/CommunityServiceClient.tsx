"use client";

import Link from "next/link";
import { useState } from "react";
import type { MakeUpProject, Member, ServiceHourEntry } from "@/app/generated/prisma/client";
import {
  ANNUAL_HOURS_REQUIRED,
  calculateServiceTotals,
  PHILANTHROPY_HOURS_REQUIRED,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  SURVIVOR_SUPPORT_HOURS_REQUIRED,
  type ServiceCategory,
} from "@/lib/communityService";
import { todayIso } from "@/lib/meetings";

type MemberWithService = Member & {
  serviceHours: ServiceHourEntry[];
  makeUpProjects: MakeUpProject[];
};

interface LogHoursForm {
  memberId: string;
  date: string;
  event: string;
  description: string;
  hours: string;
  category: ServiceCategory | "";
  volunteerContact: string;
}

function emptyLogForm(defaultMemberId: string): LogHoursForm {
  return {
    memberId: defaultMemberId,
    date: todayIso(),
    event: "",
    description: "",
    hours: "",
    category: "",
    volunteerContact: "",
  };
}

function sortByName(members: MemberWithService[]): MemberWithService[] {
  return [...members].sort((a, b) => a.name.localeCompare(b.name));
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

function ProgressBar({ value, required }: { value: number; required: number }) {
  const pct = Math.min(100, (value / required) * 100);
  const met = value >= required;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full ${met ? "bg-green-500" : "bg-burgundy-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-xs text-stone-500">
        {value}/{required}
      </span>
    </div>
  );
}

export function CommunityServiceClient({
  initialMembers,
  canManageAll,
}: {
  initialMembers: MemberWithService[];
  canManageAll: boolean;
}) {
  const [members, setMembers] = useState<MemberWithService[]>(sortByName(initialMembers));

  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState<LogHoursForm>(emptyLogForm(initialMembers[0]?.id ?? ""));
  const [logError, setLogError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  const withTotals = members.map((m) => ({
    member: m,
    totals: calculateServiceTotals(m.serviceHours),
    onMakeUp: m.makeUpProjects.length > 0,
  }));

  const metCount = withTotals.filter((m) => m.totals.total >= ANNUAL_HOURS_REQUIRED).length;

  async function handleLogHours(e: React.FormEvent) {
    e.preventDefault();
    if (!logForm.memberId) {
      setLogError("Pick who this is for.");
      return;
    }
    if (!logForm.event.trim()) {
      setLogError("Event is required.");
      return;
    }
    const hours = parseFloat(logForm.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setLogError("Hours must be greater than zero.");
      return;
    }
    if (!logForm.category) {
      setLogError("Category is required.");
      return;
    }
    if (!logForm.description.trim()) {
      setLogError("Description is required.");
      return;
    }
    if (!logForm.volunteerContact.trim()) {
      setLogError("Volunteer Contact is required.");
      return;
    }
    setLogging(true);
    setLogError(null);

    const res = await fetch("/api/community-service/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: logForm.memberId,
        date: logForm.date,
        event: logForm.event.trim(),
        description: logForm.description.trim(),
        hours,
        category: logForm.category,
        volunteerContact: logForm.volunteerContact.trim(),
      }),
    });

    setLogging(false);
    if (!res.ok) {
      setLogError(await parseError(res));
      return;
    }

    const created: ServiceHourEntry = await res.json();
    setMembers((prev) =>
      prev.map((m) =>
        m.id === logForm.memberId ? { ...m, serviceHours: [...m.serviceHours, created] } : m
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
            Met Annual Requirement
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
          {canManageAll && (
            <>
              <a
                href="/api/community-service/export"
                className="rounded-md border border-stone-300 px-3 py-1.5 text-center text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Export Hour Logs
              </a>
              <a
                href="/api/community-service/export/report"
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
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Event <span className="text-burgundy-500">*</span>
            </label>
            <input
              value={logForm.event}
              onChange={(e) => setLogForm({ ...logForm, event: e.target.value })}
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
              Category <span className="text-burgundy-500">*</span>
            </label>
            <select
              required
              value={logForm.category}
              onChange={(e) =>
                setLogForm({ ...logForm, category: e.target.value as ServiceCategory })
              }
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
              value={logForm.description}
              onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Volunteer Contact <span className="text-burgundy-500">*</span>
            </label>
            <input
              required
              value={logForm.volunteerContact}
              onChange={(e) => setLogForm({ ...logForm, volunteerContact: e.target.value })}
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
              {["Name", "Status", "Total", "Philanthropy", "Sexual Assault Awareness", ""].map((h) => (
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
            {withTotals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  No Active/Inactive members on the roster yet.
                </td>
              </tr>
            )}

            {withTotals.map(({ member, totals, onMakeUp }) => (
              <tr key={member.id}>
                <td className="px-4 py-2.5 font-medium text-stone-900">{member.name}</td>
                <td className="px-4 py-2.5">
                  {onMakeUp ? (
                    <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Make-Up
                    </span>
                  ) : totals.total >= ANNUAL_HOURS_REQUIRED ? (
                    <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      Met
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                      In Progress
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <ProgressBar value={totals.total} required={ANNUAL_HOURS_REQUIRED} />
                </td>
                <td className="px-4 py-2.5">
                  <ProgressBar
                    value={totals.philanthropy}
                    required={PHILANTHROPY_HOURS_REQUIRED}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <ProgressBar
                    value={totals.survivorSupport}
                    required={SURVIVOR_SUPPORT_HOURS_REQUIRED}
                  />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <Link
                    href={`/community-service/${member.id}`}
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
