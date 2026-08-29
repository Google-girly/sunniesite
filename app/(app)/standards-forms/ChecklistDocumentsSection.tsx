"use client";

import { useMemo, useRef, useState } from "react";
import { Section, inputClass, labelClass, th, td } from "@/components/FormSection";
import { CHECKLIST_ITEMS } from "@/lib/chapterStandardsChecklist";
import { MAX_DOCUMENT_BYTES } from "@/lib/checklistDocuments";
import { confirmDelete } from "@/lib/confirmDelete";

interface DocumentRow {
  id: string;
  code: string;
  label: string;
  fileName: string;
  mimeType: string;
  uploadedByName: string;
  createdAt: string;
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

// Reads a <input type="file"> selection into a data: URL — no upload
// endpoint needed beyond the JSON POST itself, matching how every other
// "file" already stored in this app (signatures, letterhead assets)
// works. See lib/checklistDocuments.ts for the size cap this implies.
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// A real place to attach the actual document for a credit (Aug 2026 —
// "add somewhere to upload documents like for a1 and a2 and whatever
// else") — distinct from the checklist's own self-attestation checkbox
// above, which has nothing attached to it. Not restricted to A.1/A.2:
// any CHECKLIST_ITEMS code works, plus "General" for anything that
// doesn't map to one credit.
export function ChecklistDocumentsSection({ initialDocuments }: { initialDocuments: DocumentRow[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [code, setCode] = useState("General");
  const [label, setLabel] = useState("");
  // Aug 2026 — "upload multiple pdfs for one chapter standard." A code
  // already supported more than one document (no unique constraint —
  // see prisma/schema.prisma ChecklistDocument), the file picker just
  // only ever took one at a time; this lets one selection cover several,
  // uploaded one request at a time under the same Credit + Label.
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    const groups: { section: string; items: typeof CHECKLIST_ITEMS }[] = [];
    for (const item of CHECKLIST_ITEMS) {
      const group = groups.find((g) => g.section === item.section);
      if (group) group.items.push(item);
      else groups.push({ section: item.section, items: [item] });
    }
    return groups;
  }, []);

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
    // One request at a time, not Promise.all — same reasoning as the
    // Budgets "Import from Tentative Budget" flow: keeps failures
    // attributable to a specific file, and this is a handful of files at
    // chapter scale, not a bulk operation worth parallelizing.
    const uploaded: DocumentRow[] = [];
    try {
      for (const f of files) {
        const fileData = await readFileAsDataUrl(f);
        const res = await fetch("/api/standards/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, label: label.trim(), fileName: f.name, fileData }),
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
        setDocuments((prev) => [...uploaded.reverse(), ...prev]);
      }
      setSaving(false);
      setUploadProgress(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this document?")) return;
    const res = await fetch(`/api/standards/documents/${id}`, { method: "DELETE" });
    if (res.ok) setDocuments((prev) => prev.filter((d) => d.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Documents"
      description="Upload the actual file for a credit — a charter copy, a signed letter, a screenshot — not just check it off."
    >
      <form onSubmit={handleUpload} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Credit</label>
          <select value={code} onChange={(e) => setCode(e.target.value)} className={inputClass}>
            <option value="General">General / Other</option>
            {grouped.map((g) => (
              <optgroup key={g.section} label={g.section}>
                {g.items.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} — {item.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            Label <span className="text-burgundy-500">*</span>
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Club charter copy"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            File{files.length > 1 ? "s" : ""} <span className="text-burgundy-500">*</span>{" "}
            <span className="text-stone-400">(one credit can have several)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className={`${inputClass} py-1`}
          />
          {files.length > 1 && (
            <p className="mt-1 text-xs text-stone-500">
              {files.length} files selected — all get the same Credit and Label above.
            </p>
          )}
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
        {error && <p className="sm:col-span-4 text-sm text-red-600">{error}</p>}
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Credit", "Label", "File", "Uploaded By", "Date", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-400">
                  No documents uploaded yet.
                </td>
              </tr>
            )}
            {documents.map((d) => (
              <tr key={d.id}>
                <td className={`${td} font-medium text-stone-900`}>{d.code}</td>
                <td className={td}>{d.label}</td>
                <td className={td}>
                  <a
                    href={`/api/standards/documents/${d.id}`}
                    className="font-medium text-burgundy-600 hover:text-burgundy-800"
                  >
                    {d.fileName}
                  </a>
                </td>
                <td className={td}>{d.uploadedByName}</td>
                <td className={td}>{new Date(d.createdAt).toLocaleDateString()}</td>
                <td className={`${td} text-right`}>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-xs font-medium text-stone-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
