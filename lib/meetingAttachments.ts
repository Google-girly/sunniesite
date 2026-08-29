// File uploads attached to a specific meeting (Aug 2026 — "add a
// something where the meeting minutes are where I can drop in files or
// anything else that will also be sent out with the meeting minutes").
// Same base64-data-URL-in-the-row storage and size reasoning as
// lib/checklistDocuments.ts (reused directly below rather than
// duplicated) — see that file for why the cap sits where it does.
import { MAX_DOCUMENT_BYTES } from "@/lib/checklistDocuments";

export { MAX_DOCUMENT_BYTES };

export interface MeetingAttachmentInput {
  meetingId: string;
  label: string;
  fileName: string;
  mimeType: string;
  fileData: string; // data:<mime>;base64,<...>
}

export function parseMeetingAttachmentInput(body: unknown): { data: MeetingAttachmentInput } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  const meetingId = typeof b.meetingId === "string" ? b.meetingId.trim() : "";
  if (!meetingId) {
    return { error: "Meeting is required." };
  }
  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!label) {
    return { error: "A short label for the file is required." };
  }
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

  return { data: { meetingId, label, fileName, mimeType, fileData } };
}
