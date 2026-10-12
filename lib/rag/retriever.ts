// Loads rag/index.json (built by scripts/rag-ingest.ts) once per warm
// serverless instance and answers top-K similarity queries against it by
// plain linear scan — the corpus is a few hundred chunks at 384 dimensions,
// nowhere near the scale where that needs a real vector index.
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { embedQuery } from "./embed";
import { minutesLabel } from "./minutesIndex";

export interface RetrievedChunk {
  sourceFile: string;
  section: string | null;
  content: string;
  score: number;
  /** Display name when it isn't derived from sourceFile — set for meeting minutes. */
  label?: string;
  /** Link when the source isn't a file under public/rag-source-docs/ — set for meeting minutes. */
  href?: string;
}

interface IndexedChunk {
  id: string;
  sourceFile: string;
  section: string | null;
  content: string;
  embedding: number[];
}

interface RagIndex {
  model: string;
  generatedAt: string;
  chunks: IndexedChunk[];
}

const INDEX_PATH = path.join(process.cwd(), "rag", "index.json");

let indexPromise: Promise<RagIndex> | null = null;

function loadIndex(): Promise<RagIndex> {
  if (!indexPromise) {
    indexPromise = fs.readFile(INDEX_PATH, "utf-8").then((raw) => JSON.parse(raw) as RagIndex);
  }
  return indexPromise;
}

// Embeddings are L2-normalized at embed time (see lib/rag/embed.ts), so
// cosine similarity is just the dot product — no need to divide by norms.
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// Oct 2026 — finished meeting minutes (lib/rag/minutesIndex.ts) live in
// the database rather than rag/index.json, since they change every week;
// read fresh per question and ranked in the same pool as the documents.
async function loadMinutesChunks() {
  return prisma.meetingMinutesChunk
    .findMany({ select: { meetingId: true, meetingDate: true, content: true, embedding: true } })
    .catch((err) => {
      console.error("chapter-assistant: failed to load meeting minutes chunks:", err);
      return [];
    });
}

export async function retrieve(query: string, topK = 5): Promise<RetrievedChunk[]> {
  const [index, minutes, queryEmbedding] = await Promise.all([loadIndex(), loadMinutesChunks(), embedQuery(query)]);

  const scored: RetrievedChunk[] = index.chunks.map((chunk) => ({
    sourceFile: chunk.sourceFile,
    section: chunk.section,
    content: chunk.content,
    score: dot(chunk.embedding, queryEmbedding),
  }));
  for (const chunk of minutes) {
    scored.push({
      sourceFile: `meeting-minutes/${chunk.meetingId}`,
      section: null,
      content: chunk.content,
      score: dot(chunk.embedding, queryEmbedding),
      label: minutesLabel(chunk.meetingDate),
      href: `/api/meeting-minutes/meetings/${chunk.meetingId}/final-minutes`,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
