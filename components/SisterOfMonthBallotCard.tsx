"use client";

import { useEffect, useState } from "react";
import type { Member } from "@/app/generated/prisma/client";

interface VoteResult {
  member: { id: string; name: string };
  count: number;
}

interface VoteResponse {
  open: boolean;
  period: { year: number; month: string } | null;
  results?: VoteResult[];
  totalVotes?: number;
  myVote?: string | null;
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

// Shown on the Dashboard to any Active member — Sister of the Month is
// a chapter-wide "general consensus" vote, not something tucked inside
// the (locked) Sisterhood module. See lib/sisterOfMonthVoting.ts and
// MODULES.md for the fuller design writeup.
export function SisterOfMonthBallotCard({ activeMembers }: { activeMembers: Member[] }) {
  const [data, setData] = useState<VoteResponse | null>(null);
  const [nomineeId, setNomineeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    fetch("/api/standards/sister-of-month/vote")
      .then((res) => res.json())
      .then((d: VoteResponse) => {
        setData(d);
        if (d.myVote) setNomineeId(d.myVote);
      })
      .catch(() => setData(null));
  }, []);

  async function handleVote(e: React.FormEvent) {
    e.preventDefault();
    if (!nomineeId) return;
    setVoting(true);
    setError(null);
    const res = await fetch("/api/standards/sister-of-month/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomineeId }),
    });
    setVoting(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const refreshed = await fetch("/api/standards/sister-of-month/vote").then((r) => r.json());
    setData(refreshed);
  }

  if (!data || !data.period || !data.open) return null;

  return (
    <div className="mb-6 rounded-lg border border-burgundy-200 bg-burgundy-50/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-burgundy-700">
        Sister of the Month — {data.period.month}
      </p>
      <p className="mt-1 text-sm text-stone-600">
        Vote for who you think deserves it this month — {data.totalVotes ?? 0} vote
        {(data.totalVotes ?? 0) === 1 ? "" : "s"} so far.
      </p>

      <form onSubmit={handleVote} className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={nomineeId}
          onChange={(e) => setNomineeId(e.target.value)}
          className="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        >
          <option value="">— Pick a sister —</option>
          {activeMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={voting || !nomineeId}
          className="rounded-md bg-burgundy-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
        >
          {voting ? "Saving..." : data.myVote ? "Change My Vote" : "Vote"}
        </button>
        {data.myVote && !error && (
          <span className="text-xs text-stone-500">
            You voted for {activeMembers.find((m) => m.id === data.myVote)?.name ?? "—"}.
          </span>
        )}
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
