"use client";

import { useRef, useState } from "react";
import { MAX_DOCUMENT_BYTES } from "@/lib/meetingFinalMinutes";
import { confirmDelete } from "@/lib/confirmDelete";

export interface FinalMinutesMeta {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedByName: string;
  uploadedByMemberId: string | null;
  createdAt: string;
  updatedAt: string;
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Sept 2026 — "add a place where I can upload the finished meeting
// minutes so they can be seen by anyone on the website." The one
// canonical, hand-completed file for this meeting — Roll Call, motions,
// and Meeting Adjourned filled in after exporting the draft above.
// Choosing a new file replaces whatever's already here rather than
// keeping both. This page is officer-only, but once uploaded the file
// is downloadable by every logged-in member from the Meeting Minutes
// list (see MinutesListClient.tsx) — see the API route's own comment
// for why that GET has no officer gate.
export function FinalMinutesSection({
  meetingId,
  viewerId,
  viewerOwnsModule,
  initial,
}: {
  meetingId: string;
  viewerId: string;
  /** Vice President of Communications, Historian, or President — can remove anyone's upload, not just her own. */
  viewerOwnsModule: boolean;
  initial: FinalMinutesMeta | null;
}) {
  const [current, setCurrent] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError(`"${file.name}" is too large — max ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fileData = await readFileAsDataUrl(file);
      const res = await fetch(`/api/meeting-minutes/meetings/${meetingId}/final-minutes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileData }),
      });
      if (!res.ok) {
        setError(await parseError(res));
        return;
      }
      setCurrent(await res.json());
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!current) return;
    if (!confirmDelete(`Remove the finished minutes (${current.fileName})? Anyone with the list page will no longer be able to download it.`)) return;
    setRemoving(true);
    const res = await fetch(`/api/meeting-minutes/meetings/${meetingId}/final-minutes`, { method: "DELETE" });
    setRemoving(false);
    if (res.ok) {
      setCurrent(null);
    } else {
      alert(await parseError(res));
    }
  }

  const canRemove = current !== null && (current.uploadedByMemberId === viewerId || viewerOwnsModule);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-900">Finished Minutes</h3>
      <p className="mt-0.5 text-xs text-stone-500">
        The completed file, ready to share — every sister can view or download it from the Meeting
        Minutes list once it&apos;s here.
      </p>

      {current && (
        <p className="mt-3 text-sm">
          <a
            href={`/api/meeting-minutes/meetings/${meetingId}/final-minutes`}
            className="font-medium text-burgundy-600 hover:text-burgundy-800 hover:underline"
          >
            {current.fileName}
          </a>{" "}
          <span className="text-stone-400">— uploaded by {current.uploadedByName}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input ref={fileInputRef} type="file" onChange={handleChoose} disabled={saving} className="text-sm" />
        {saving && <span className="text-sm text-stone-500">Uploading...</span>}
        {canRemove && (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs font-medium text-stone-400 hover:text-red-600 disabled:opacity-50"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        )}
      </div>
      {current && (
        <p className="mt-1 text-xs text-stone-400">Choose another file above to replace this one.</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
