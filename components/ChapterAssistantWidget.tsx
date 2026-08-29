"use client";

// Floating chat widget over the chapter's governing documents (Bylaws,
// Standards, Standing Rules, Traditions, Pledgeship materials, etc. — see
// MODULES.md's Chapter Assistant entries for the exact document set and
// why it stops there). Mounted once in app/(app)/layout.tsx, so it's
// available on every page behind login. Talks to POST
// /api/chapter-assistant, which streams back a metadata line (sources +
// an interaction id for feedback) followed by the answer as plain text —
// see lib/rag/prompt.ts streamAnswer() for the wire format.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface Source {
  name: string;
  path: string;
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  interactionId?: string | null;
  feedback?: "up" | "down" | null;
  error?: boolean;
  streaming?: boolean;
}

const HISTORY_SENT = 6; // keep the request small — matches the server's own cap

// Minimal markdown styling to match the app's stone/rose palette — no
// @tailwindcss/typography plugin installed, so this is a hand-rolled
// subset covering what the system prompt actually asks the model to use
// (headings, lists, tables, bold, links).
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-rose-700 underline">
      {children}
    </a>
  ),
  h1: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  code: ({ children }) => (
    <code className="rounded bg-stone-200 px-1 py-0.5 text-[12px]">{children}</code>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-stone-300 bg-stone-100 px-2 py-1 text-left">{children}</th>
  ),
  td: ({ children }) => <td className="border border-stone-300 px-2 py-1">{children}</td>,
};

function sourceHref(path: string): string {
  return "/rag-source-docs/" + path.split("/").map(encodeURIComponent).join("/");
}

export function ChapterAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Fires on every message added AND on every streamed content update
  // (each chunk replaces the array via setMessages) — instant, not
  // smooth, so rapid streaming updates don't queue up a stack of
  // competing scroll animations.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;

    const history = messages.slice(-HISTORY_SENT).map((m) => ({ role: m.role, content: m.content }));
    const assistantIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", streaming: true },
    ]);
    setInput("");
    setLoading(true);

    const updateAssistant = (patch: Partial<DisplayMessage>) => {
      setMessages((prev) => prev.map((m, i) => (i === assistantIndex ? { ...m, ...patch } : m)));
    };
    const appendAssistant = (text: string) => {
      setMessages((prev) =>
        prev.map((m, i) => (i === assistantIndex ? { ...m, content: m.content + text } : m))
      );
    };

    try {
      const res = await fetch("/api/chapter-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        updateAssistant({ content: data?.error ?? "Something went wrong.", error: true, streaming: false });
        return;
      }
      if (!res.body) throw new Error("No response body.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let metadataParsed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (!metadataParsed) {
          const newlineAt = buffer.indexOf("\n");
          if (newlineAt === -1) continue; // wait for the rest of the metadata line
          const metaLine = buffer.slice(0, newlineAt);
          buffer = buffer.slice(newlineAt + 1);
          metadataParsed = true;
          try {
            const meta = JSON.parse(metaLine);
            updateAssistant({ sources: meta.sources ?? [], interactionId: meta.interactionId ?? null });
          } catch {
            // Malformed metadata line — keep going without sources/rating rather than losing the answer.
          }
        }

        if (buffer) {
          appendAssistant(buffer);
          buffer = "";
        }
      }
      updateAssistant({ streaming: false });
    } catch {
      updateAssistant({
        content: "Couldn't reach the assistant — check your connection and try again.",
        error: true,
        streaming: false,
      });
    } finally {
      setLoading(false);
    }
  }

  async function rate(index: number, rating: "up" | "down") {
    const message = messages[index];
    if (!message.interactionId || message.feedback) return;
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, feedback: rating } : m)));
    await fetch(`/api/chapter-assistant/feedback/${message.interactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    }).catch(() => {
      // Best-effort — if this fails the vote just doesn't stick server-side; not worth surfacing an error over.
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-rose-700 text-white shadow-lg transition-colors hover:bg-rose-800"
        aria-label="Open La Mujer chat"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- small static mascot asset, not worth next/image's overhead here */}
        <img src="/mascot/la-mujer.png" alt="" className="h-11 w-11 object-contain" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col rounded-lg border border-stone-200 bg-white shadow-xl">
      <div className="flex items-center justify-between rounded-t-lg border-b border-stone-200 bg-rose-50 px-4 py-3">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- small static mascot asset, not worth next/image's overhead here */}
          <img src="/mascot/la-mujer.png" alt="" className="h-8 w-8 object-contain" />
          <p className="text-sm font-semibold text-rose-700">La Mujer</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-stone-400 hover:text-stone-600"
          aria-label="Close La Mujer chat"
        >
          ✕
        </button>
      </div>

      <p className="border-b border-stone-200 px-4 py-2 text-[11px] leading-snug text-stone-500">
        Answers are generated from chapter documents and may not always be complete — verify
        important policy questions with your officers.{" "}
        <Link href="/chapter-assistant-log" className="underline hover:text-stone-700">
          View question log
        </Link>
      </p>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-stone-400">
            Ask about Bylaws, Standards, Standing Rules, Traditions, Pledgeship, or the Code of
            Ethics.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-rose-700 text-white whitespace-pre-wrap"
                  : m.error
                    ? "bg-red-50 text-red-700 whitespace-pre-wrap"
                    : "bg-stone-100 text-stone-800"
              }`}
            >
              {m.role === "assistant" && !m.error ? (
                m.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {m.content}
                  </ReactMarkdown>
                ) : m.streaming ? (
                  <span className="text-stone-400">Thinking…</span>
                ) : null
              ) : (
                m.content
              )}

              {m.sources && m.sources.length > 0 && (
                <p className="mt-1.5 border-t border-stone-200 pt-1.5 text-[11px] text-stone-500">
                  Source:{" "}
                  {m.sources.map((s, si) => (
                    <span key={s.path}>
                      {si > 0 && ", "}
                      <a href={sourceHref(s.path)} target="_blank" rel="noreferrer" className="underline hover:text-stone-700">
                        {s.name}
                      </a>
                    </span>
                  ))}
                </p>
              )}

              {m.role === "assistant" && !m.streaming && !m.error && m.interactionId && (
                <div className="mt-1.5 flex gap-2 text-xs">
                  <button
                    onClick={() => rate(i, "up")}
                    disabled={!!m.feedback}
                    aria-label="Good answer"
                    className={`${m.feedback === "up" ? "opacity-100" : "opacity-40 hover:opacity-70"} disabled:cursor-default`}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => rate(i, "down")}
                    disabled={!!m.feedback}
                    aria-label="Bad answer"
                    className={`${m.feedback === "down" ? "opacity-100" : "opacity-40 hover:opacity-70"} disabled:cursor-default`}
                  >
                    👎
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-stone-200 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask a question…"
          className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-rose-400 focus:outline-none"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
