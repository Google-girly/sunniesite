"use client";

import Link from "next/link";
import { useState } from "react";
import type { Member, Meeting, MeetingNote, OfficerReport } from "@/app/generated/prisma/client";
import { formatMeetingDate } from "@/lib/meetingMinutes";
import { OFFICER_POSITIONS, type OfficerPosition } from "@/lib/positions";
import { findRoleHolderNames } from "@/lib/roster";
import {
  MEETING_NOTE_CATEGORIES,
  MEETING_NOTE_CATEGORY_LABELS,
  type MeetingNoteCategory,
} from "@/lib/meetingNotes";
import { confirmDelete } from "@/lib/confirmDelete";

type MeetingNoteWithAuthor = MeetingNote & { author: Member | null };
type MeetingWithReports = Meeting & { officerReports: OfficerReport[]; notes: MeetingNoteWithAuthor[] };
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
  canEdit,
  onSaved,
  onDeleted,
}: {
  meetingId: string;
  position: OfficerPosition;
  holders: string | null;
  existing: OfficerReport | undefined;
  /** Whether the viewer holds this position (or owns the module) — see MeetingMinutesClient below. */
  canEdit: boolean;
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
        disabled={!canEdit}
        placeholder={canEdit ? "Report for this meeting..." : "No report submitted."}
        className="mt-2 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400 disabled:bg-stone-50 disabled:text-stone-500"
      />
      {canEdit ? (
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-burgundy-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
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
      ) : (
        <p className="mt-2 text-xs text-stone-400">
          Only whoever holds {position} (or the Secretary/President) can edit this one.
        </p>
      )}
    </div>
  );
}

function MeetingNoteSection({
  meetingId,
  category,
  notes,
  viewerId,
  viewerOwnsModule,
  onAdded,
  onRemoved,
}: {
  meetingId: string;
  category: MeetingNoteCategory;
  notes: MeetingNoteWithAuthor[];
  viewerId: string;
  viewerOwnsModule: boolean;
  onAdded: (note: MeetingNoteWithAuthor) => void;
  onRemoved: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/meeting-minutes/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, category, text: text.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const note: MeetingNoteWithAuthor = await res.json();
    onAdded(note);
    setText("");
  }

  async function handleRemove(note: MeetingNoteWithAuthor) {
    if (!confirmDelete(`Remove this ${MEETING_NOTE_CATEGORY_LABELS[category]} entry?`)) return;
    const res = await fetch(`/api/meeting-minutes/notes/${note.id}`, { method: "DELETE" });
    if (res.ok) onRemoved(note.id);
    else alert(await parseError(res));
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-900">{MEETING_NOTE_CATEGORY_LABELS[category]}</h3>

      {notes.length === 0 ? (
        <p className="mt-2 text-sm text-stone-400">Nothing added yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {notes.map((note) => {
            const canRemove = note.authorMemberId === viewerId || viewerOwnsModule;
            return (
              <li key={note.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p className="text-stone-800">{note.text}</p>
                  <p className="text-xs text-stone-400">— {note.authorName}</p>
                </div>
                {canRemove && (
                  <button
                    onClick={() => handleRemove(note)}
                    className="shrink-0 text-xs font-medium text-stone-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder={`Add to ${MEETING_NOTE_CATEGORY_LABELS[category].toLowerCase()}...`}
          className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !text.trim()}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add"}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function MeetingMinutesClient({
  meeting,
  members,
  viewerId,
  viewerPositions,
  viewerOwnsModule,
}: {
  meeting: MeetingWithReports;
  members: MemberLite[];
  /** Who's logged in — she can only edit an Officer Report for a position she actually holds. */
  viewerId: string;
  viewerPositions: string[];
  /** Vice President of Communications, Historian, or President — can edit/remove anyone's Officer Report or Meeting Note. */
  viewerOwnsModule: boolean;
}) {
  const [reports, setReports] = useState(meeting.officerReports);
  const [notes, setNotes] = useState(meeting.notes);

  function upsertLocal(report: OfficerReport) {
    setReports((prev) => [...prev.filter((r) => r.id !== report.id), report]);
  }

  return (
    <div>
      <Link
        href="/meetings-reports/minutes"
        className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
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
            className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700"
          >
            Export Minutes
          </a>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-medium text-stone-900">Officer Reports</h2>
      <p className="mt-1 text-sm text-stone-500">
        {reports.length} / {OFFICER_POSITIONS.length} reports submitted. Each officer can only
        submit her own position&apos;s report — the Secretary/President can edit any of them.
      </p>

      <div className="mt-4 space-y-4">
        {OFFICER_POSITIONS.map((position) => (
          <OfficerReportRow
            key={position}
            meetingId={meeting.id}
            position={position}
            holders={findRoleHolderNames(members, position)}
            existing={reports.find((r) => r.position === position)}
            canEdit={viewerOwnsModule || viewerPositions.includes(position)}
            onSaved={upsertLocal}
            onDeleted={() => setReports((prev) => prev.filter((r) => r.position !== position))}
          />
        ))}
      </div>

      <h2 className="mt-8 text-lg font-medium text-stone-900">Action Items, Business &amp; More</h2>
      <p className="mt-1 text-sm text-stone-500">
        Open to every sister — anyone can add to any of these. Meeting Adjourned stays hand-filled,
        same as Roll Call and Approval of Minutes/Agenda.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MEETING_NOTE_CATEGORIES.map((category) => (
          <MeetingNoteSection
            key={category}
            meetingId={meeting.id}
            category={category}
            notes={notes.filter((n) => n.category === category)}
            viewerId={viewerId}
            viewerOwnsModule={viewerOwnsModule}
            onAdded={(note) => setNotes((prev) => [...prev, note])}
            onRemoved={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}
