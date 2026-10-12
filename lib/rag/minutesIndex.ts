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
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
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

async function extractText(mimeType: string, fileName: string, bytes: Buffer): Promise<string | null> {
  const lower = fileName.toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    const parser = new PDFParse({ data: bytes });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }
  if (mimeType === DOCX_MIME || lower.endsWith(".docx")) {
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
