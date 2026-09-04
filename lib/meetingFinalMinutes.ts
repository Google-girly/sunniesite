// The single "finished" minutes document for a meeting (Sept 2026 —
// "add a place where I can upload the finished meeting minutes so they
// can be seen by anyone on the website"). Distinct from
// lib/meetingAttachments.ts (a running list of flyers/handouts that
// ride along on the meeting email): this is the one canonical file —
// the docx exported from the Meeting Minutes editing page, then
// hand-filled with Roll Call, motions, and Meeting Adjourned — that
// stands as the actual record of what happened. Uploading again
// replaces the prior one rather than piling up versions. Same
// base64-data-URL storage and size cap as every other upload in the
// app — see lib/checklistDocuments.ts for why the cap sits where it
// does.
import { MAX_DOCUMENT_BYTES } from "@/lib/checklistDocuments";

export { MAX_DOCUMENT_BYTES };

export interface FinalMinutesInput {
  fileName: string;
  mimeType: string;
  fileData: string; // data:<mime>;base64,<...>
}

export function parseFinalMinutesInput(body: unknown): { data: FinalMinutesInput } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  const fileName = typeof b.fileName === "string" ? b.fileName.trim() : "";
  if (!fileName) {
    return { error: "No file selected." };
  }
  const fileData = typeof b.fileData === "string" ? b.fileData : "";
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(fileData);
  if (!match) {
    return { error: "Couldn't read that file — try a different one." };
  }
  const [, mimeType, base64] = match;
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_DOCUMENT_BYTES) {
    return { error: `That file is too large — ${Math.round(approxBytes / 1024 / 1024)}MB, max is ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB.` };
  }

  return { data: { fileName, mimeType, fileData } };
}
