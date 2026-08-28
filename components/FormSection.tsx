"use client";

import { useState } from "react";
import type { Member } from "@/app/generated/prisma/client";

// Shared collapsible-section chrome + a handful of style constants used
// by every "add form + table" module page (Academics, Sisterhood,
// Leadership, Standards Forms' old sections before the Aug 2026
// reorganization into a checklist + dedicated pages — see MODULES.md).
// Pulled out to components/ once these pages stopped sharing one file.
export const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400";
export const labelClass = "block text-xs font-medium text-stone-600";
export const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500";
export const td = "px-3 py-2 text-sm";

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  // Closed by default so a page with several of these (Standards Forms
  // especially, with one per Chapter Standards section) stays compact —
  // click a section's header to expand it.
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          <p className="mt-0.5 text-xs text-stone-500">{description}</p>
        </div>
        <span className="text-stone-400">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="border-t border-stone-100 px-5 py-4">{children}</div>}
    </div>
  );
}

export function MemberSelect({
  members,
  value,
  onChange,
}: {
  members: Member[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">— Select —</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

export async function parseFormError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}
