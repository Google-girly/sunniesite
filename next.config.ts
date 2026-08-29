import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Budget export reads lib/templates/*.xlsx off disk at runtime (not via
  // an import), so Next's file tracer wouldn't otherwise know to ship it
  // with a standalone/production build. Only matters once this is
  // actually deployed — harmless locally.
  outputFileTracingIncludes: {
    "/api/budgets/[id]/export": ["./lib/templates/**/*"],
    "/api/budgets/[id]/versions/[versionId]/export": ["./lib/templates/**/*"],
    "/api/finances/export": ["./lib/templates/**/*"],
    // Chapter Assistant's local embedding model + prebuilt chunk index —
    // both generated files (see scripts/rag-ingest.ts), read off disk at
    // runtime rather than imported, so the tracer wouldn't otherwise know
    // to ship them. Also onnxruntime-node's native binaries: its
    // .node addon IS require()'d (so the tracer finds that much on its
    // own), but the addon dynamically links against libonnxruntime.so.1
    // sitting next to it in the same folder — a dlopen from *inside* the
    // compiled addon, invisible to any JS-level static analysis — so
    // without this the deployed function has the addon but not the
    // shared library it needs, and fails at runtime with "cannot open
    // shared object file" (seen in production, Aug 2026). Only linux/**
    // (both x64 and arm64, since Vercel's actual build architecture isn't
    // worth hard-coding a bet on) — the darwin/win32 binaries Vercel never
    // runs would add ~155MB of dead weight to the function for nothing.
    "/api/chapter-assistant": [
      "./rag/models/**/*",
      "./rag/index.json",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/**/*",
    ],
  },
};

export default nextConfig;
