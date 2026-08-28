"use client";

// Floating chat widget over the chapter's governing documents (Bylaws,
// Standards, Standing Rules, Traditions, etc. — see MODULES.md's Chapter
// Assistant entry for the exact document set and why it stops there).
// Mounted once in app/(app)/layout.tsx, so it's available on every page
// behind login. Talks to POST /api/chapter-assistant, which is itself
// gated on being logged in — no separate access check needed here.
import { useRef, useState } from "react";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  error?: boolean;
}

const HISTORY_SENT = 6; // keep the request small — matches the server's own cap

export function ChapterAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;

    const nextMessages: DisplayMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(-HISTORY_SENT).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chapter-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data?.error ?? "Something went wrong.", error: true },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer, sources: data.sources },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Couldn't reach the assistant — check your connection and try again.", error: true },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-burgundy-700 text-white shadow-lg transition-colors hover:bg-burgundy-800"
        aria-label="Open Chapter Assistant"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.97-4.03 9-9 9-1.5 0-2.9-.37-4.14-1.02L3 21l1.06-3.68A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col rounded-lg border border-stone-200 bg-white shadow-xl">
      <div className="flex items-center justify-between rounded-t-lg border-b border-stone-200 bg-burgundy-50 px-4 py-3">
        <p className="text-sm font-semibold text-burgundy-700">Chapter Assistant</p>
        <button
          onClick={() => setOpen(false)}
          className="text-stone-400 hover:text-stone-600"
          aria-label="Close Chapter Assistant"
        >
          ✕
        </button>
      </div>

      <p className="border-b border-stone-200 px-4 py-2 text-[11px] leading-snug text-stone-500">
        Answers are generated from chapter documents and may not always be complete — verify
        important policy questions with your officers.
      </p>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-stone-400">
            Ask about Bylaws, Standards, Standing Rules, Traditions, or the Code of Ethics.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-burgundy-700 text-white"
                  : m.error
                    ? "bg-red-50 text-red-700"
                    : "bg-stone-100 text-stone-800"
              }`}
            >
              {m.content}
              {m.sources && m.sources.length > 0 && (
                <p className="mt-1.5 text-[11px] text-stone-500">Source: {m.sources.join(", ")}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <p className="text-xs text-stone-400">
            Thinking… first question after a while can take a few extra seconds.
          </p>
        )}
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
          className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="rounded-md bg-burgundy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-burgundy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
