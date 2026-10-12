// Oct 2026 — "feed my rag model my meeting minutes so I can query my
// meeting minutes too." Indexes each meeting's *finished* minutes (the
// file uploaded on the meeting page, see lib/meetingFinalMinutes.ts)
// into MeetingMinutesChunk so lib/rag/retriever.ts can search them next
// to the static rag/index.json documents.
//
// Only finished minutes, never draft officer reports: finished minutes
// are already open to every logged-in member (same audience as the
// assistant), while drafts are position-restricted.
//
// Indexing runs lazily from the Chapter Assistant route itself rather
// than on upload — that route is the one function that ships the
// embedding model (see next.config.ts outputFileTracingIncludes), so
// the first question after an upload/replace pays a few seconds to
// index it and nobody ever has to re-run `npm run rag:ingest` for
// minutes.
import { prisma } from "@/lib/prisma";
import { formatMeetingDate } from "@/lib/meetingMinutes";
import { chunkDocument } from "./chunk";
import { embedDocumentBatch } from "./embed";

// Caps how long one question can be held up by indexing — a big
// backlog (e.g. the first run, covering every past meeting) spreads
// over the next few questions instead.
const MAX_FILES_PER_PASS = 3;

// Well under bge-small's 512-token input limit (see lib/rag/chunk.ts),
// and small enough that one chunk is roughly one or two officers'
// reports rather than half the meeting.
const MINUTES_CHUNK_SIZES = { targetWords: 180, maxWords: 230, overlapWords: 30 };

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// The PDF/Word libraries are imported here, lazily, rather than at the
// top of the file: this module is loaded by the Chapter Assistant route
// itself, so a library that fails to load on Vercel would otherwise take
// the whole assistant down with it (it did — Oct 2026, right after the
// first version imported pdf-parse at the top; pdf-parse depends on the
// @napi-rs/canvas native addon, the same class of problem as the
// onnxruntime .so in next.config.ts). Loaded here, a failure only skips
// indexing that file.
//
// PDFs go through pdfjs-dist's legacy build directly (pdf-parse is a
// wrapper around it, and scripts/rag-ingest.ts still uses pdf-parse
// locally): it only *tries* the canvas addon inside its own try/catch,
// and plain text extraction doesn't need it. Its worker is imported
// statically and handed over via globalThis.pdfjsWorker so it runs
// in-process — no separate worker file for Vercel's tracer to miss.
async function extractPdfText(bytes: Buffer): Promise<string> {
  // pdf.js builds a `new DOMMatrix()` the moment it loads, and in Node it
  // only gets one from @napi-rs/canvas — without that addon, the import
  // itself throws "DOMMatrix is not defined" (reproduced locally by
  // hiding the addon). Text extraction never uses it (only page
  // rendering does), so an empty stand-in is enough to let it load.
  const g = globalThis as { DOMMatrix?: unknown; pdfjsWorker?: unknown };
  g.DOMMatrix ??= class DOMMatrix {};
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // @ts-expect-error -- pdfjs-dist ships no type declarations for its worker module
  g.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true })
    .promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push(
        content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")).join("")
      );
    }
    // A blank line between pages so chunkDocument's paragraph split
    // still has boundaries to work with.
    return pages.join("\n\n");
  } finally {
    await doc.destroy();
  }
}

async function extractText(mimeType: string, fileName: string, bytes: Buffer): Promise<string | null> {
  const lower = fileName.toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return extractPdfText(bytes);
  if (mimeType === DOCX_MIME || lower.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    return (await mammoth.extractRawText({ buffer: bytes })).value;
  }
  return null; // images, old .doc, etc. — nothing to index
}

export function minutesLabel(meetingDate: string): string {
  return `Meeting Minutes — ${formatMeetingDate(meetingDate)}`;
}

async function indexOne(finalMinutesId: string): Promise<void> {
  const file = await prisma.meetingFinalMinutes.findUnique({
    where: { id: finalMinutesId },
    include: { meeting: { select: { id: true, date: true } } },
  });
  if (!file) return;

  const bytes = Buffer.from(file.fileData.split(",").pop() ?? "", "base64");
  const text = await extractText(file.mimeType, file.fileName, bytes);
  // The meeting date goes into every chunk's text (and so its embedding)
  // so "what did we decide at the October 12 meeting" can match on it.
  const header = `${minutesLabel(file.meeting.date)}\n`;
  const contents = text ? chunkDocument(text, MINUTES_CHUNK_SIZES).map((c) => header + c.content) : [];
  const embeddings = contents.length > 0 ? await embedDocumentBatch(contents) : [];

  await prisma.$transaction(async (tx) => {
    await tx.meetingMinutesChunk.deleteMany({ where: { finalMinutesId } });
    if (contents.length > 0) {
      await tx.meetingMinutesChunk.createMany({
        data: contents.map((content, i) => ({
          finalMinutesId,
          meetingId: file.meeting.id,
          meetingDate: file.meeting.date,
          content,
          embedding: embeddings[i],
        })),
      });
    }
    // updatedAt is passed back unchanged — otherwise @updatedAt would
    // bump it past ragIndexedAt and this file would look stale forever.
    // Matching on the old updatedAt also means a re-upload that landed
    // mid-indexing rolls this back, so the new file gets indexed instead.
    const marked = await tx.meetingFinalMinutes.updateMany({
      where: { id: finalMinutesId, updatedAt: file.updatedAt },
      data: { ragIndexedAt: new Date(), updatedAt: file.updatedAt },
    });
    if (marked.count === 0) throw new Error("finished minutes replaced while indexing");
  });
}

/** Indexes any finished minutes uploaded or replaced since they were last indexed. Never throws. */
export async function indexPendingMinutes(): Promise<void> {
  try {
    const files = await prisma.meetingFinalMinutes.findMany({
      select: { id: true, updatedAt: true, ragIndexedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    const stale = files
      .filter((f) => !f.ragIndexedAt || f.ragIndexedAt < f.updatedAt)
      .slice(0, MAX_FILES_PER_PASS);
    for (const { id, updatedAt } of stale) {
      try {
        await indexOne(id);
      } catch (err) {
        console.error(`chapter-assistant: failed to index finished minutes ${id}:`, err);
        // Marked anyway so an unreadable file isn't retried (and doesn't
        // slow down) every question — uploading a replacement retries it.
        await prisma.meetingFinalMinutes
          .updateMany({ where: { id, updatedAt }, data: { ragIndexedAt: new Date(), updatedAt } })
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error("chapter-assistant: minutes indexing pass failed:", err);
  }
}
