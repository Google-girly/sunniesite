"use client";

import Link from "next/link";
import { useState } from "react";
import type { Member, Meeting, OfficerReport } from "@/app/generated/prisma/client";
import { formatMeetingDate } from "@/lib/meetingMinutes";
import { OFFICER_POSITIONS, type OfficerPosition } from "@/lib/positions";
import { findRoleHolderNames } from "@/lib/roster";
import { confirmDelete } from "@/lib/confirmDelete";

type MeetingWithReports = Meeting & { officerReports: OfficerReport[] };
type MemberLite = Pick<Member, "name" | "role">;

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

function OfficerReportRow({
  meetingId,
  position,
  holders,
  existing,
  onSaved,
  onDeleted,
}: {
  meetingId: string;
  position: OfficerPosition;
  holders: string | null;
  existing: OfficerReport | undefined;
  onSaved: (report: OfficerReport) => void;
  onDeleted: () => void;
}) {
  const [text, setText] = useState(existing?.report ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!text.trim()) {
      setError("Report text can't be blank — remove it instead if there's nothing to submit.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/meeting-minutes/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, position, report: text.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const saved: OfficerReport = await res.json();
    onSaved(saved);
    setSaved(true);
  }

  async function handleRemove() {
    if (!existing) return;
    if (!confirmDelete(`Remove the ${position} report?`)) return;
    const res = await fetch(`/api/meeting-minutes/reports/${existing.id}`, { method: "DELETE" });
    if (res.ok) {
      setText("");
      onDeleted();
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-900">{position}</h3>
        <p className="text-xs text-stone-500">{holders || "No one currently holds this position"}</p>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={3}
        placeholder="Report for this meeting..."
        className="mt-2 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : existing ? "Update" : "Submit"}
        </button>
        {existing && (
          <button onClick={handleRemove} className="text-sm font-medium text-stone-400 hover:text-red-600">
            Remove
          </button>
        )}
        {saved && !error && <span className="text-sm text-green-600">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

export function MeetingMinutesClient({
  meeting,
  members,
}: {
  meeting: MeetingWithReports;
  members: MemberLite[];
}) {
  const [reports, setReports] = useState(meeting.officerReports);

  function upsertLocal(report: OfficerReport) {
    setReports((prev) => [...prev.filter((r) => r.id !== report.id), report]);
  }

  return (
    <div>
      <Link
        href="/meetings-reports/minutes"
        className="text-sm font-medium text-rose-600 hover:text-rose-800"
      >
        ← All Meetings
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">
            {formatMeetingDate(meeting.date)}
          </h1>
          <p className="mt-1 text-sm text-stone-500">{meeting.time || "No time on file"}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/meetings-reports/minutes/${meeting.id}/final`}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Final Version →
          </Link>
          <a
            href={`/api/meeting-minutes/export/${meeting.id}`}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            Export Minutes
          </a>
        </div>
      </div>
      <p className="mt-2 text-sm text-stone-500">
        {reports.length} / {OFFICER_POSITIONS.length} reports submitted. Anyone can submit for any
        position — there&apos;s no per-officer login, so this runs on the honor system like the
        rest of the app.
      </p>

      <div className="mt-6 space-y-4">
        {OFFICER_POSITIONS.map((position) => (
          <OfficerReportRow
            key={position}
            meetingId={meeting.id}
            position={position}
            holders={findRoleHolderNames(members, position)}
            existing={reports.find((r) => r.position === position)}
            onSaved={upsertLocal}
            onDeleted={() => setReports((prev) => prev.filter((r) => r.position !== position))}
          />
        ))}
      </div>
    </div>
  );
}
