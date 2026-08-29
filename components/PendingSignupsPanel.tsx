"use client";

import { useEffect, useState } from "react";
import type { Member } from "@/app/generated/prisma/client";
import { confirmDelete } from "@/lib/confirmDelete";

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

// Right-side slide-over (Aug 2026, replacing the old standalone
// /pending-signups page/module — "make pending signups a pop-up bar on
// the right hand side of the officer tools as opposed to its own
// module") — same approve/deny logic and routes as before
// (app/api/officers/pending). Two trigger buttons render this same
// panel: the President's lives on Manage Officers & Logins
// (app/(app)/officers/page.tsx — "the pending sign ups should be a
// button on the manage officers and logins module"); Vice President
// and VP of Communications don't have that page, so theirs stays in
// components/Sidebar.tsx's Officer Tools section instead. Both are
// gated by the caller (canApproveSignups()) before this ever renders.
export function PendingSignupsPanel({
  buttonClassName = "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900",
}: {
  /** Lets the officers page style this as a solid action button instead of the sidebar's nav-link look. */
  buttonClassName?: string;
}) {
  const [pending, setPending] = useState<Member[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/officers/pending");
    if (res.ok) setPending(await res.json());
  }

  // Just the count on mount (for the badge) — the full fetch above
  // re-runs it anyway once the panel opens. Inlined (rather than
  // calling refresh()) so the linter can see straight through to the
  // setPending call — same pattern as components/SisterOfMonthBallotCard.tsx.
  useEffect(() => {
    fetch("/api/officers/pending")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPending(data))
      .catch(() => {});
  }, []);

  async function approve(member: Member) {
    setBusyId(member.id);
    setError(null);
    const res = await fetch(`/api/officers/pending/${member.id}`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    setPending((prev) => (prev ?? []).filter((m) => m.id !== member.id));
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
    setPending((prev) => (prev ?? []).filter((m) => m.id !== member.id));
  }

  const count = pending?.length ?? 0;

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          refresh();
        }}
        className={buttonClassName}
      >
        <span>Pending Sign-Ups</span>
        {count > 0 && (
          <span className="rounded-full bg-burgundy-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-stone-900/30"
          />
          <div className="relative z-50 flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Pending Sign-Ups</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Sisters who requested an account — approve to let her log in, or deny to remove
                  the request.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex-1">
              {pending === null ? (
                <p className="text-sm text-stone-400">Loading…</p>
              ) : pending.length === 0 ? (
                <p className="text-sm text-stone-500">No pending sign-up requests right now.</p>
              ) : (
                <ul className="space-y-3">
                  {pending.map((m) => (
                    <li key={m.id} className="rounded-lg border border-stone-200 p-4">
                      <p className="font-medium text-stone-900">{m.name}</p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-500">
                        <div>
                          <dt className="inline font-medium text-stone-600">Nickname: </dt>
                          <dd className="inline">{m.nickname || "—"}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-stone-600">Class: </dt>
                          <dd className="inline">{m.class || "—"}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-stone-600">Line #: </dt>
                          <dd className="inline">{m.crossingNumber ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-stone-600">Role: </dt>
                          <dd className="inline">{m.role || "General Member"}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-stone-600">Status: </dt>
                          <dd className="inline">{m.status}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-stone-600">Crossing Term: </dt>
                          <dd className="inline">{m.crossingTerm || "—"}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="inline font-medium text-stone-600">Email: </dt>
                          <dd className="inline">{m.email || "—"}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="inline font-medium text-stone-600">Phone: </dt>
                          <dd className="inline">{m.phone || "—"}</dd>
                        </div>
                        {m.notes && (
                          <div className="col-span-2">
                            <dt className="inline font-medium text-stone-600">Notes: </dt>
                            <dd className="inline">{m.notes}</dd>
                          </div>
                        )}
                      </dl>
                      <div className="mt-3 flex items-center gap-3">
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
                          className="text-xs font-medium text-stone-400 hover:text-red-600"
                        >
                          Deny
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
