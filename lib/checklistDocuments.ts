// Actual document uploads for a Chapter Standards credit (Aug 2026 —
// "add somewhere to upload documents like for a1 and a2 and whatever
// else"). See prisma/schema.prisma ChecklistDocument for why the file
// itself is a base64 data URL rather than external blob storage.
//
// No blob storage means the file rides along in the API request/
// response body, which on Vercel is capped well under a real scanned
// PDF's size (~4.5MB total request body on Hobby/Pro, base64 inflating
// the real file by ~33% on top of that) — so this caps well inside
// that ceiling rather than at some larger "looks reasonable" number.
export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024; // 3MB real file size (~4MB once base64-encoded)

export interface ChecklistDocumentInput {
  code: string;
  label: string;
  fileName: string;
  mimeType: string;
  fileData: string; // data:<mime>;base64,<...>
}

export function parseChecklistDocumentInput(body: unknown): { data: ChecklistDocumentInput } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  const code = typeof b.code === "string" ? b.code.trim() : "";
  if (!code) {
    return { error: "Select which Chapter Standards credit this is for (or General)." };
  }
  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!label) {
    return { error: "A short label for the document is required." };
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
  // Real decoded byte size, not the (33% larger) base64 string length.
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_DOCUMENT_BYTES) {
    return { error: `That file is too large — ${Math.round(approxBytes / 1024 / 1024)}MB, max is ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB.` };
  }

  return { data: { code, label, fileName, mimeType, fileData } };
}
