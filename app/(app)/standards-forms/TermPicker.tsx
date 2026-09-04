"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Term } from "@/lib/studyHours";

// URL-driven (not local state) because this page's checklist counts are
// computed server-side from Prisma — picking a term has to trigger a
// fresh server render via the `term` search param, not just a client
// re-render. Only rendered for President/VP/VP of Communications — see
// lib/permissions.ts canSelectTerm.
export function TermPicker({ terms, selected }: { terms: Term[]; selected: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="mb-4 flex items-center gap-2">
      <label htmlFor="term" className="text-sm font-medium text-stone-600">
        Term
      </label>
      <select
        id="term"
        value={selected}
        onChange={(e) => router.push(`${pathname}?term=${encodeURIComponent(e.target.value)}`)}
        className="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
      >
        {terms.map((t) => (
          <option key={t.label} value={t.label}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
