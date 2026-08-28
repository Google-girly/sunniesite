// Rebuilds rag/index.json from every PDF in rag/source_docs/ — run this
// with `npm run rag:ingest` any time a document there is added, replaced,
// or removed, then commit both the changed source PDF and the regenerated
// rag/index.json. See MODULES.md's Chapter Assistant entry for what's
// allowed into rag/source_docs/ in the first place (short version: only
// the approved governance-document set — never credentials, financial
// data, or individual member records).
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { env } from "@huggingface/transformers";
import { chunkDocument } from "../lib/rag/chunk";
import { embedBatch, MODELS_DIR } from "../lib/rag/embed";

const SOURCE_DIR = path.join(process.cwd(), "rag", "source_docs");
const INDEX_PATH = path.join(process.cwd(), "rag", "index.json");

// lib/rag/embed.ts sets allowRemoteModels false as a module-level default,
// for the app's own runtime. This script is the one place allowed to flip
// it back on — env is a shared mutable object, so this takes effect for
// every later pipeline() call in this process (embedBatch below is only
// ever invoked further down, inside main()). First run with no cached
// model in rag/models/ fetches it from HF Hub once; every run after that
// just reads the local cache.
env.allowRemoteModels = true;
env.localModelPath = MODELS_DIR;
env.cacheDir = MODELS_DIR;

interface IndexedChunk {
  id: string; // sha256 of sourceFile + content — stable across reruns
  sourceFile: string;
  section: string | null;
  content: string;
  embedding: number[];
}

async function extractText(pdfPath: string): Promise<string> {
  const buffer = await fs.readFile(pdfPath);
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function hashChunk(sourceFile: string, content: string): string {
  return createHash("sha256").update(sourceFile).update("\n").update(content).digest("hex");
}

async function main() {
  const files = (await fs.readdir(SOURCE_DIR)).filter((f) => f.toLowerCase().endsWith(".pdf"));
  if (files.length === 0) {
    throw new Error(`No PDFs found in ${SOURCE_DIR}`);
  }

  const allChunks: IndexedChunk[] = [];
  const counts: Record<string, number> = {};

  for (const file of files) {
    const fullPath = path.join(SOURCE_DIR, file);
    const text = await extractText(fullPath);
    const chunks = chunkDocument(text);
    counts[file] = chunks.length;

    const embeddings = await embedBatch(chunks.map((c) => c.content));
    chunks.forEach((chunk, i) => {
      allChunks.push({
        id: hashChunk(file, chunk.content),
        sourceFile: file,
        section: chunk.section,
        content: chunk.content,
        embedding: embeddings[i],
      });
    });
  }

  await fs.writeFile(
    INDEX_PATH,
    JSON.stringify(
      {
        model: "Xenova/all-MiniLM-L6-v2",
        generatedAt: new Date().toISOString(),
        chunks: allChunks,
      },
      null,
      0
    )
  );

  console.log(`Wrote ${allChunks.length} chunks from ${files.length} documents to ${INDEX_PATH}`);
  for (const [file, count] of Object.entries(counts)) {
    console.log(`  ${file}: ${count} chunks`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
