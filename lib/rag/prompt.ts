// System prompt + context assembly + the actual Groq call for the Chapter
// Assistant. Kept separate from app/api/chapter-assistant/route.ts so the
// prompt wording and the HTTP/auth/rate-limit plumbing can change
// independently.
import type { RetrievedChunk } from "./retriever";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are the Chapter Assistant for Sigma Omega Nu, Theta Chapter — a chatbot that answers member questions using only the chapter's official governing documents, which are provided to you as labeled context below.

Rules:
- Answer only using the provided context chunks. Do not use outside knowledge of sororities, Greek life, or this organization.
- When you give an answer, say which document it came from (e.g. "per the Chapter Standing Rules...").
- If the context doesn't contain the answer, say plainly that you don't have that information in the documents you have access to, and suggest asking the relevant officer or the President — never guess or fabricate a bylaw, rule, or policy detail.
- Keep a friendly, helpful tone appropriate for sorority members and prospective members.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantReply {
  answer: string;
  sources: string[];
}

function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const heading = chunk.section ? ` — ${chunk.section}` : "";
      return `[Source ${i + 1}: ${displayName(chunk.sourceFile)}${heading}]\n${chunk.content}`;
    })
    .join("\n\n");
}

function displayName(sourceFile: string): string {
  return sourceFile.replace(/\.pdf$/i, "");
}

export async function generateAnswer(
  question: string,
  contextChunks: RetrievedChunk[],
  history: ChatMessage[]
): Promise<AssistantReply> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set.");
  }

  const contextBlock =
    contextChunks.length > 0
      ? `Context from chapter documents:\n\n${formatContext(contextChunks)}`
      : "No relevant context was found in the chapter documents for this question.";

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    // Short recent history for conversational follow-ups — the client
    // caps what it sends (see components/ChapterAssistantWidget.tsx).
    ...history,
    { role: "user" as const, content: `${contextBlock}\n\nQuestion: ${question}` },
  ];

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.2 }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Groq API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const answer: string = data?.choices?.[0]?.message?.content ?? "";
  const sources = [...new Set(contextChunks.map((c) => displayName(c.sourceFile)))];

  return { answer, sources };
}
