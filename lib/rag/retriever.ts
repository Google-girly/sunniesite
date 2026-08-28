// Loads rag/index.json (built by scripts/rag-ingest.ts) once per warm
// serverless instance and answers top-K similarity queries against it by
// plain linear scan — the corpus is a few hundred chunks at 384 dimensions,
// nowhere near the scale where that needs a real vector index.
import fs from "node:fs/promises";
import path from "node:path";
import { embedText } from "./embed";

export interface RetrievedChunk {
  sourceFile: string;
  section: string | null;
  content: string;
  score: number;
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

export async function retrieve(query: string, topK = 5): Promise<RetrievedChunk[]> {
  const [index, queryEmbedding] = await Promise.all([loadIndex(), embedText(query)]);

  const scored = index.chunks.map((chunk) => ({
    sourceFile: chunk.sourceFile,
    section: chunk.section,
    content: chunk.content,
    score: dot(chunk.embedding, queryEmbedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
