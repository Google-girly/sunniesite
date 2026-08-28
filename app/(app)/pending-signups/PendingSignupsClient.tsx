"use client";

import { useState } from "react";
import type { Member } from "@/app/generated/prisma/client";
import { confirmDelete } from "@/lib/confirmDelete";

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

export function PendingSignupsClient({ initialPending }: { initialPending: Member[] }) {
  const [pending, setPending] = useState(initialPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(member: Member) {
    setBusyId(member.id);
    setError(null);
    const res = await fetch(`/api/officers/pending/${member.id}`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    setPending((prev) => prev.filter((m) => m.id !== member.id));
  }

  async function deny(member: Member) {
    if (!confirmDelete(`Deny ${member.name}'s sign-up request? This deletes it — she'd have to request again.`))
      return;
    setBusyId(member.id);
    setError(null);
    const res = await fetch(`/api/officers/pending/${member.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    setPending((prev) => prev.filter((m) => m.id !== member.id));
  }

  if (pending.length === 0) {
    return <p className="text-sm text-stone-500">No pending sign-up requests right now.</p>;
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Name", "Email", "Requested", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {pending.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2.5 font-medium text-stone-900">{m.name}</td>
                <td className="px-4 py-2.5 text-stone-600">{m.email || "—"}</td>
                <td className="px-4 py-2.5 text-stone-600">
                  {new Date(m.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <button
                    onClick={() => approve(m)}
                    disabled={busyId === m.id}
                    className="rounded-md bg-burgundy-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-burgundy-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => deny(m)}
                    disabled={busyId === m.id}
                    className="ml-2 text-xs font-medium text-stone-400 hover:text-red-600"
                  >
                    Deny
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
