// Shared embedding pipeline for the Chapter Assistant RAG feature — used by
// both scripts/rag-ingest.ts (embeds every chunk) and lib/rag/retriever.ts
// (embeds each incoming question with the same model, required for cosine
// similarity to mean anything).
//
// `@huggingface/transformers` is in Next.js's own built-in
// serverExternalPackages allowlist (alongside onnxruntime-node), so it
// bundles and runs on Vercel Node serverless functions with no extra
// next.config.ts wiring.
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import path from "node:path";

// bge-small-en-v1.5 (Aug 2026 swap, replacing all-MiniLM-L6-v2 — see
// MODULES.md's Chapter Assistant entry) retrieves noticeably better
// against short/structured documents. BGE models are trained
// asymmetrically: queries need an instruction prefix prepended for best
// retrieval accuracy, documents don't — see embedQuery vs embedDocument
// below. Getting this backwards (or applying it to both) measurably hurts
// results, so don't just call embedText from new code.
const MODEL_ID = "Xenova/bge-small-en-v1.5";
const QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: ";
const MODELS_DIR = path.join(process.cwd(), "rag", "models");

// The app's own query-time runtime never touches the network for this —
// it only ever reads the copy scripts/rag-ingest.ts already downloaded
// into rag/models/ and committed to the repo. The ingest script flips
// `allowRemoteModels` on for itself before its first call (see there) to
// actually fetch the weights the first time it's run.
env.localModelPath = MODELS_DIR;
env.allowRemoteModels = false;
env.allowLocalModels = true;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    // q8 (int8) quantized weights — much smaller than the fp32 default,
    // which matters here since rag/models/ gets committed to the repo and
    // shipped with every deploy.
    pipelinePromise = pipeline("feature-extraction", MODEL_ID, {
      dtype: "q8",
    }) as Promise<FeatureExtractionPipeline>;
  }
  return pipelinePromise;
}

async function embed(text: string): Promise<number[]> {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: "cls", normalize: true });
  return Array.from(output.data as Float32Array);
}

async function embedBatchRaw(texts: string[]): Promise<number[][]> {
  const extractor = await getPipeline();
  const output = await extractor(texts, { pooling: "cls", normalize: true });
  const dims = output.dims[output.dims.length - 1];
  const data = output.data as Float32Array;
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(Array.from(data.slice(i * dims, (i + 1) * dims)));
  }
  return vectors;
}

/** Embed a user's question — retrieval-side, gets BGE's query instruction prefix. */
export async function embedQuery(text: string): Promise<number[]> {
  return embed(QUERY_INSTRUCTION + text);
}

/** Embed a document chunk at ingest time — no instruction prefix. */
export async function embedDocument(text: string): Promise<number[]> {
  return embed(text);
}

/** Batched document embedding — much faster than one-at-a-time for ingesting many chunks. */
export async function embedDocumentBatch(texts: string[]): Promise<number[][]> {
  return embedBatchRaw(texts);
}

export { MODEL_ID, MODELS_DIR };
