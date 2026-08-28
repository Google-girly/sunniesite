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
    // to ship them.
    "/api/chapter-assistant": ["./rag/models/**/*", "./rag/index.json"],
  },
};

export default nextConfig;
