// Rebuilds rag/index.json from every PDF/.docx/.xlsx in
// public/rag-source-docs/ — run this with `npm run rag:ingest` any time a
// document there is added, replaced, or removed, then commit both the
// changed source file and the regenerated rag/index.json. See MODULES.md's
// Chapter Assistant entries for what's allowed in there in the first
// place (short version: nothing with credentials, financial data, or
// individual member records — and check actual file content before
// adding, never just the filename; "Template"/"Copy of" in a name has
// turned out filled with real data more than once in this Drive export).
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { env } from "@huggingface/transformers";
import { chunkDocument, type Chunk } from "../lib/rag/chunk";
import { extractXlsxSheets } from "../lib/rag/xlsx";
import { embedDocumentBatch, MODEL_ID, MODELS_DIR } from "../lib/rag/embed";

const SOURCE_DIR = path.join(process.cwd(), "public", "rag-source-docs");
const INDEX_PATH = path.join(process.cwd(), "rag", "index.json");

// lib/rag/embed.ts sets allowRemoteModels false as a module-level default,
// for the app's own runtime. This script is the one place allowed to flip
// it back on — env is a shared mutable object, so this takes effect for
// every later pipeline() call in this process (embedDocumentBatch below is
// only ever invoked further down, inside main()). First run with no cached
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

async function extractPdfText(fullPath: string): Promise<string> {
  const buffer = await fs.readFile(fullPath);
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(fullPath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: fullPath });
  return result.value;
}

// PDF/docx just chunk their extracted text directly; .xlsx is chunked one
// sheet at a time, with the sheet name forced as every resulting chunk's
// `section` (chunk.ts's own heading-detection regex has no chance against
// spreadsheet text — there's no prose to find an ARTICLE/Section line in).
async function chunksForFile(fullPath: string): Promise<Chunk[]> {
  const lower = fullPath.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    const sheets = await extractXlsxSheets(fullPath);
    return sheets.flatMap((sheet) =>
      chunkDocument(sheet.text).map((chunk) => ({ ...chunk, section: sheet.name }))
    );
  }
  const text = lower.endsWith(".docx") ? await extractDocxText(fullPath) : await extractPdfText(fullPath);
  return chunkDocument(text);
}

function hashChunk(sourceFile: string, content: string): string {
  return createHash("sha256").update(sourceFile).update("\n").update(content).digest("hex");
}

// Recursively finds every .pdf/.docx/.xlsx under dir, returned as paths
// relative to SOURCE_DIR (e.g. "pledgeship/Chapter Sister Contract.pdf")
// — the approved set is organized into subfolders (pledgeship/,
// reference/, disaffiliated-organizations/) alongside the original flat
// core-governance set at the root, purely for maintainability; nothing
// about the folder structure itself matters to retrieval, and the
// widget only ever shows the filename (see lib/rag/prompt.ts displayName).
async function findSourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findSourceFiles(fullPath)));
    } else if (/\.(pdf|docx|xlsx)$/i.test(entry.name)) {
      results.push(path.relative(SOURCE_DIR, fullPath));
    }
  }
  return results;
}

async function main() {
  const files = await findSourceFiles(SOURCE_DIR);
  if (files.length === 0) {
    throw new Error(`No source files found in ${SOURCE_DIR}`);
  }

  const allChunks: IndexedChunk[] = [];
  const counts: Record<string, number> = {};
  const suspect: string[] = [];

  for (const file of files) {
    const fullPath = path.join(SOURCE_DIR, file);
    const chunks = await chunksForFile(fullPath);
    counts[file] = chunks.length;

    // A file that produced no chunks (or almost no real words) likely
    // failed to extract meaningful text at all — e.g. a PDF whose content
    // is rendered as graphics rather than selectable text (caught exactly
    // this way once already, see MODULES.md). Flag it instead of silently
    // shipping a citation that points at nothing.
    const totalWords = chunks.reduce((sum, c) => sum + c.content.split(/\s+/).filter(Boolean).length, 0);
    if (totalWords < 15) suspect.push(`${file} (${totalWords} words total)`);

    const embeddings = await embedDocumentBatch(chunks.map((c) => c.content));
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
        model: MODEL_ID,
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
  if (suspect.length > 0) {
    console.warn(`\nSuspiciously low text yield — check these extracted properly:`);
    for (const s of suspect) console.warn(`  ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
