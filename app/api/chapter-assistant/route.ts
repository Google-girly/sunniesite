import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/session";
import { retrieve } from "@/lib/rag/retriever";
import { generateAnswer, type ChatMessage } from "@/lib/rag/prompt";

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
    const chunks = await retrieve(message, 5);
    const reply = await generateAnswer(message, chunks, history);
    return NextResponse.json(reply);
  } catch (err) {
    console.error("chapter-assistant error:", err);
    return NextResponse.json(
      { error: "Something went wrong answering that — try again in a moment." },
      { status: 502 }
    );
  }
}
