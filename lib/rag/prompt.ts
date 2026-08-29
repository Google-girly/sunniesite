// System prompt + context assembly + the actual Groq call for the Chapter
// Assistant. Kept separate from app/api/chapter-assistant/route.ts so the
// prompt wording and the HTTP/auth/rate-limit plumbing can change
// independently.
import type { RetrievedChunk } from "./retriever";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile was retired from Groq's free tier at some point
// after this was first written (confirmed 404 model_not_found in
// production, Aug 2026) — gpt-oss-120b is the strongest general instruct
// model on Groq's current free catalog. If this ever 404s again, check
// the live list with `GET https://api.groq.com/openai/v1/models` rather
// than guessing a name from memory — Groq's free-tier lineup changes.
const GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are the Chapter Assistant for Sigma Omega Nu, Theta Chapter — a chatbot that answers member questions using only the chapter's official governing documents, which are provided to you as labeled context below.

Rules:
- Answer only using the provided context chunks. Do not use outside knowledge of sororities, Greek life, or this organization.
- When you give an answer, say which document it came from (e.g. "per the Chapter Standing Rules...").
- If the context doesn't contain the answer, say plainly that you don't have that information in the documents you have access to, and suggest asking the relevant officer or the President — never guess or fabricate a bylaw, rule, or policy detail.
- Keep a friendly, helpful tone appropriate for sorority members and prospective members.
- Format with Markdown where it helps readability (headings, bullet/numbered lists, tables, **bold**) — the chat widget renders it. Don't overdo it: a short answer doesn't need headings.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// sourceFile is a path relative to public/rag-source-docs/ (e.g.
// "pledgeship/Chapter Sister Contract.pdf") — `path` keeps that so the
// widget can link straight to the file (served as a static asset,
// session-gated by proxy.ts same as everything else); `name` is just the
// filename for display, sans extension.
export interface Source {
  name: string;
  path: string;
}

// Thrown specifically on a 429 so app/api/chapter-assistant/route.ts can
// tell "the free tier's shared token budget is briefly exhausted — ask
// again in a few seconds" apart from a real failure. This account's Groq
// free tier caps every model at 8000 tokens/minute (confirmed via the
// x-ratelimit-limit-tokens response header, Aug 2026) — shared across all
// members hitting this one endpoint, not per-member, so it's worth
// surfacing distinctly rather than as a generic error.
export class GroqRateLimitError extends Error {}

function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const heading = chunk.section ? ` — ${chunk.section}` : "";
      return `[Source ${i + 1}: ${displayName(chunk.sourceFile)}${heading}]\n${chunk.content}`;
    })
    .join("\n\n");
}

function displayName(sourceFile: string): string {
  const base = sourceFile.split("/").pop() ?? sourceFile;
  return base.replace(/\.(pdf|docx|xlsx)$/i, "");
}

/** Distinct source documents behind a set of retrieved chunks — known as soon as retrieval finishes, no need to wait on generation. */
export function sourcesFromChunks(chunks: RetrievedChunk[]): Source[] {
  const seen = new Map<string, Source>();
  for (const chunk of chunks) {
    if (!seen.has(chunk.sourceFile)) {
      seen.set(chunk.sourceFile, { name: displayName(chunk.sourceFile), path: chunk.sourceFile });
    }
  }
  return [...seen.values()];
}

/** Best (highest) retrieval similarity score among the given chunks — a low/absent value is this session's proxy for "the docs probably don't cover this," used for the Chapter Assistant Log's confidence column. */
export function topScore(chunks: RetrievedChunk[]): number | null {
  if (chunks.length === 0) return null;
  return Math.max(...chunks.map((c) => c.score));
}

function buildMessages(question: string, contextChunks: RetrievedChunk[], history: ChatMessage[]) {
  const contextBlock =
    contextChunks.length > 0
      ? `Context from chapter documents:\n\n${formatContext(contextChunks)}`
      : "No relevant context was found in the chapter documents for this question.";

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    // Short recent history for conversational follow-ups — the client
    // caps what it sends (see components/ChapterAssistantWidget.tsx).
    ...history,
    { role: "user" as const, content: `${contextBlock}\n\nQuestion: ${question}` },
  ];
}

// Streams the answer as plain UTF-8 text chunks (already unwrapped from
// Groq's SSE `data: {...}` framing — app/api/chapter-assistant/route.ts's
// caller doesn't need to know anything about that). Throws before any
// streaming starts if Groq's initial response isn't ok (missing key,
// rate limit, model error, etc.), so the route can still return a normal
// JSON error with the right status code for those cases — only a
// genuinely-started 200 response gets piped through as a stream.
export async function streamAnswer(
  question: string,
  contextChunks: RetrievedChunk[],
  history: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set.");
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: buildMessages(question, contextChunks, history),
      temperature: 0.2,
      // Bounds output tokens against the shared 8000 TPM budget above —
      // still generous enough for a real grounded answer (~500-600
      // words), just not an unbounded one.
      max_tokens: 700,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new GroqRateLimitError(`Groq rate limit hit: ${body}`);
    }
    throw new Error(`Groq API error ${response.status}: ${body}`);
  }
  if (!response.body) {
    throw new Error("Groq API returned no response body.");
  }

  // Groq's stream is OpenAI-compatible SSE: lines like
  // `data: {"choices":[{"delta":{"content":"..."}}]}`, ending with
  // `data: [DONE]`. Unwrap it down to just the text deltas.
  const groqBody = response.body;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = groqBody.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep a possibly-incomplete last line for next read
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice("data:".length).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta: string = json?.choices?.[0]?.delta?.content ?? "";
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // A malformed/partial SSE line — skip it rather than fail
              // the whole stream over one bad event.
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
