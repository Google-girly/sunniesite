"use client";

import { useEffect, useRef, useState } from "react";

// Oct 2026 — "a preview of the finished meeting minutes." Opens the
// uploaded Finished Minutes file (see lib/meetingFinalMinutes.ts) right
// on the page instead of forcing a download. It's whatever an officer
// uploaded, so the type is checked after fetching: PDFs and images use
// the browser's own viewer, Word files are drawn in-browser by
// docx-preview (nothing is sent to an outside conversion service), and
// anything else just offers the download.
type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "pdf" | "image"; objectUrl: string }
  | { status: "docx" }
  | { status: "unsupported" };

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function loadPreview(url: string, docxContainer: HTMLElement): Promise<PreviewState> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { status: "error", message: data?.error ?? "Couldn't load the finished minutes." };
    }
    const blob = await res.blob();
    const type = blob.type.split(";")[0];
    if (type === "application/pdf") return { status: "pdf", objectUrl: URL.createObjectURL(blob) };
    if (type.startsWith("image/")) return { status: "image", objectUrl: URL.createObjectURL(blob) };
    if (type === DOCX_MIME) {
      const { renderAsync } = await import("docx-preview");
      docxContainer.innerHTML = "";
      await renderAsync(blob, docxContainer, undefined, {
        inWrapper: true,
        ignoreLastRenderedPageBreak: true,
        breakPages: true,
      });
      return { status: "docx" };
    }
    return { status: "unsupported" };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Couldn't load the preview." };
  }
}

export function FinishedMinutesPreview({
  meetingId,
  fileName,
  onClose,
}: {
  meetingId: string;
  fileName: string;
  onClose: () => void;
}) {
  const docxRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const fileUrl = `/api/meeting-minutes/meetings/${meetingId}/final-minutes`;

  useEffect(() => {
    const container = docxRef.current;
    if (!container) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    loadPreview(fileUrl, container).then((next) => {
      if ("objectUrl" in next) objectUrl = next.objectUrl;
      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      setState(next);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-900/60" role="dialog" aria-modal="true" aria-label="Finished minutes preview">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900">Finished Minutes</p>
          <p className="truncate text-xs text-stone-500">{fileName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={fileUrl}
            className="rounded-md bg-burgundy-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-burgundy-700"
          >
            Download
          </a>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-500 hover:text-stone-800"
          >
            Close
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto bg-stone-200">
        {state.status === "loading" && (
          <p className="absolute inset-x-0 top-8 text-center text-sm text-stone-600">Loading preview…</p>
        )}
        {state.status === "error" && <p className="px-4 py-8 text-center text-sm text-red-600">{state.message}</p>}
        {state.status === "unsupported" && (
          <p className="px-4 py-8 text-center text-sm text-stone-700">
            This file type can&apos;t be previewed here — use Download to open it.
          </p>
        )}
        {state.status === "pdf" && <iframe src={state.objectUrl} title={fileName} className="h-full w-full bg-white" />}
        {state.status === "image" && (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, nothing for next/image to optimize
          <img src={state.objectUrl} alt={fileName} className="mx-auto my-6 max-w-full bg-white shadow" />
        )}
        {/* Always mounted so docx-preview has somewhere to draw; hidden unless that's what loaded. */}
        <div ref={docxRef} className={state.status === "docx" ? undefined : "hidden"} />
      </div>
    </div>
  );
}
