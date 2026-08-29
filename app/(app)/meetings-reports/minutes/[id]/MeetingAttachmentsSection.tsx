"use client";

import { useRef, useState } from "react";
import { MAX_DOCUMENT_BYTES } from "@/lib/meetingAttachments";
import { confirmDelete } from "@/lib/confirmDelete";

export interface MeetingAttachmentRow {
  id: string;
  meetingId: string;
  label: string;
  fileName: string;
  mimeType: string;
  uploadedByName: string;
  uploadedByMemberId: string | null;
  createdAt: string;
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

// "Add a something where the meeting minutes are where I can drop in
// files or anything else that will also be sent out with the meeting
// minutes" (Aug 2026) — a flyer, a handout, a photo, whatever doesn't
// belong in the minutes docx itself. Every file here rides along as its
// own attachment on this meeting's reminder/test email (see
// lib/meetingReminders.ts buildMeetingEmailContent).
export function MeetingAttachmentsSection({
  meetingId,
  viewerId,
  viewerOwnsModule,
  initialAttachments,
}: {
  meetingId: string;
  viewerId: string;
  /** Vice President of Communications, Historian, or President — can remove anyone's file, not just her own. */
  viewerOwnsModule: boolean;
  initialAttachments: MeetingAttachmentRow[];
}) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [label, setLabel] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setError("Choose at least one file.");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_DOCUMENT_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" is too large — max ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB.`);
      return;
    }
    setSaving(true);
    setError(null);
    setUploadProgress({ done: 0, total: files.length });
    const uploaded: MeetingAttachmentRow[] = [];
    try {
      for (const f of files) {
        const fileData = await readFileAsDataUrl(f);
        const res = await fetch("/api/meeting-minutes/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId, label: label.trim(), fileName: f.name, fileData }),
        });
        if (!res.ok) {
          setError(`"${f.name}": ${await parseError(res)}`);
          return;
        }
        uploaded.push(await res.json());
        setUploadProgress({ done: uploaded.length, total: files.length });
      }
      setLabel("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      if (uploaded.length > 0) {
        setAttachments((prev) => [...uploaded.reverse(), ...prev]);
      }
      setSaving(false);
      setUploadProgress(null);
    }
  }

  async function handleDelete(attachment: MeetingAttachmentRow) {
    if (!confirmDelete(`Remove "${attachment.label}" (${attachment.fileName})?`)) return;
    setDeletingId(attachment.id);
    const res = await fetch(`/api/meeting-minutes/attachments/${attachment.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-900">Files &amp; Attachments</h3>
      <p className="mt-0.5 text-xs text-stone-500">
        Anything else that should go out with this meeting&apos;s email — a flyer, a handout, a
        photo. Sent as its own attachment alongside the minutes.
      </p>

      <form onSubmit={handleUpload} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-stone-600">
            Label <span className="text-burgundy-500">*</span>
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Retreat flyer"
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600">
            File{files.length > 1 ? "s" : ""} <span className="text-burgundy-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving || !label.trim() || files.length === 0}
            className="w-full rounded-md bg-burgundy-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-burgundy-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? uploadProgress
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
                : "Uploading..."
              : files.length > 1
                ? `Upload (${files.length})`
                : "Upload"}
          </button>
        </div>
        {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
      </form>

      {attachments.length === 0 ? (
        <p className="mt-3 text-sm text-stone-400">Nothing attached yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-stone-100">
          {attachments.map((a) => {
            const canRemove = a.uploadedByMemberId === viewerId || viewerOwnsModule;
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <a
                    href={`/api/meeting-minutes/attachments/${a.id}`}
                    className="font-medium text-burgundy-600 hover:text-burgundy-800 hover:underline"
                  >
                    {a.label}
                  </a>{" "}
                  <span className="text-stone-400">
                    — {a.fileName} · {a.uploadedByName}
                  </span>
                </div>
                {canRemove && (
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={deletingId === a.id}
                    className="shrink-0 text-xs font-medium text-stone-400 hover:text-red-600 disabled:opacity-50"
                  >
                    {deletingId === a.id ? "Removing..." : "Remove"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
