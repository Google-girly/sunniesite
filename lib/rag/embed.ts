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

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
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
    // q8 (int8) quantized weights — ~25MB instead of the ~90MB fp32
    // default, which matters here since rag/models/ gets committed to the
    // repo and shipped with every deploy.
    pipelinePromise = pipeline("feature-extraction", MODEL_ID, {
      dtype: "q8",
    }) as Promise<FeatureExtractionPipeline>;
  }
  return pipelinePromise;
}

/** Mean-pooled, L2-normalized embedding for one piece of text. */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/** Same as embedText, but batched — much faster for ingesting many chunks. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const extractor = await getPipeline();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const dims = output.dims[output.dims.length - 1];
  const data = output.data as Float32Array;
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(Array.from(data.slice(i * dims, (i + 1) * dims)));
  }
  return vectors;
}

export { MODEL_ID, MODELS_DIR };
