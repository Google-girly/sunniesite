import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { retrieve } from "@/lib/rag/retriever";
import { streamAnswer, sourcesFromChunks, topScore, GroqRateLimitError, type ChatMessage } from "@/lib/rag/prompt";

// Open to every logged-in member (same spirit as the "standards-forms"
// module) — there's no ModuleKey for this since it's a persistent overlay,
// not a page. getCurrentMember() is the only gate: no session, no answer.

const HISTORY_LIMIT = 6; // last few turns only, keeps the Groq prompt small

// Best-effort per-member rate limit against the free Groq tier's limits —
// an in-memory Map, so it resets on cold start and isn't shared across
// serverless instances. That's fine here: this is a courtesy guard against
// one member accidentally hammering the endpoint, not a security boundary
// (the real boundary is being logged in at all).
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const requestLog = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(memberId: string): boolean {
  const now = Date.now();
  const entry = requestLog.get(memberId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    requestLog.set(memberId, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  if (isRateLimited(member.id)) {
    return NextResponse.json(
      { error: "Too many questions in a short time — try again in a few minutes." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const rawHistory = Array.isArray(body?.history) ? body.history : [];
  const history: ChatMessage[] = rawHistory
    .filter(
      (m: unknown): m is ChatMessage =>
        !!m &&
        typeof m === "object" &&
        (("role" in m && (m as { role: unknown }).role === "user") ||
          (m as { role: unknown }).role === "assistant") &&
        typeof (m as { content: unknown }).content === "string"
    )
    .slice(-HISTORY_LIMIT);

  try {
    // 4, not 5 — Groq's free tier shares one 8000-tokens/minute budget
    // across every member hitting this endpoint (confirmed via its
    // x-ratelimit-limit-tokens header, Aug 2026), and each chunk here
    // runs ~650-1050 tokens. Trimmed one chunk off top-k specifically to
    // leave more of that budget for the response itself.
    const chunks = await retrieve(message, 4);
    const sources = sourcesFromChunks(chunks);

    // This call to Groq (with stream:true) either throws before anything
    // is sent back to the browser — missing key, rate limit, model error,
    // caught below and returned as a normal JSON error — or succeeds and
    // hands back a stream of plain answer text. Only the success path
    // commits to a streaming Response.
    const answerStream = await streamAnswer(message, chunks, history);

    // Logged immediately (answer still "") so there's an id to attach a
    // thumbs up/down to before generation even finishes streaming — see
    // PATCH /api/chapter-assistant/feedback/[id]. Not awaited-critical:
    // if this write fails, the member still gets her answer, she just
    // won't be able to rate it (caught and logged, not thrown).
    const interaction = await prisma.chapterAssistantInteraction
      .create({
        data: {
          memberId: member.id,
          question: message,
          sources: JSON.stringify(sources),
          topScore: topScore(chunks),
        },
      })
      .catch((err) => {
        console.error("chapter-assistant: failed to log interaction:", err);
        return null;
      });

    const encoder = new TextEncoder();
    let fullAnswer = "";
    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ sources, interactionId: interaction?.id ?? null }) + "\n")
        );
        const reader = answerStream.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullAnswer += decoder.decode(value, { stream: true });
            controller.enqueue(value);
          }
        } finally {
          controller.close();
          if (interaction) {
            await prisma.chapterAssistantInteraction
              .update({ where: { id: interaction.id }, data: { answer: fullAnswer } })
              .catch((err) => console.error("chapter-assistant: failed to save answer:", err));
          }
        }
      },
    });

    return new Response(responseStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    if (err instanceof GroqRateLimitError) {
      console.warn("chapter-assistant rate limited:", err.message);
      return NextResponse.json(
        {
          error:
            "The assistant is getting a lot of questions right now (shared free-tier limit) — try again in about 15 seconds.",
        },
        { status: 429 }
      );
    }
    console.error("chapter-assistant error:", err);
    return NextResponse.json(
      { error: "Something went wrong answering that — try again in a moment." },
      { status: 502 }
    );
  }
}
