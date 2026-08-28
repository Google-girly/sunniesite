"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ChecklistOverride } from "@/app/generated/prisma/client";
import { Section } from "@/components/FormSection";
import { CHECKLIST_ITEMS, CHECKLIST_SECTIONS, type ChecklistItem } from "@/lib/chapterStandardsChecklist";

const levelBadge: Record<string, string> = {
  Obligatory: "bg-red-50 text-red-700",
  Required: "bg-amber-50 text-amber-700",
  Expected: "bg-blue-50 text-blue-700",
  Additional: "bg-stone-100 text-stone-600",
};

function StatusBadge({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        done ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
      }`}
    >
      {done ? "✓" : "○"} {label}
    </span>
  );
}

// A hint, not a verdict: shows whether the app found real data for a
// "linked" item, but never marks the credit Done by itself — see the
// `kind` doc comment in lib/chapterStandardsChecklist.ts. Only the
// officer's own checkbox below does that.
function DataHint({ hasData }: { hasData: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        hasData ? "bg-blue-50 text-blue-700" : "bg-stone-100 text-stone-500"
      }`}
    >
      {hasData ? "✓" : "○"} {hasData ? "Data on file" : "No data yet"}
    </span>
  );
}

function ChecklistRow({
  item,
  hasData,
  confirmed,
  onToggle,
}: {
  item: ChecklistItem;
  hasData: boolean;
  confirmed: boolean;
  onToggle?: (code: string, checked: boolean) => void;
}) {
  return (
    <tr>
      <td className="px-3 py-2 text-sm font-medium text-stone-900">{item.code}</td>
      <td className="px-3 py-2 text-sm text-stone-900">
        {item.title}
        {item.note && <p className="mt-0.5 text-xs text-stone-400">{item.note}</p>}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${levelBadge[item.level] ?? ""}`}>
          {item.level}
        </span>
      </td>
      <td className="px-3 py-2">
        {item.kind === "verified" ? (
          <StatusBadge done label="Verified by National" />
        ) : (
          <div className="flex flex-col items-start gap-1">
            {item.kind === "linked" && <DataHint hasData={hasData} />}
            <label className="inline-flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => onToggle?.(item.code, e.target.checked)}
              />
              {confirmed ? "Confirmed done" : "Mark done"}
            </label>
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {item.href && (
          <Link href={item.href} className="text-sm font-medium text-rose-600 hover:text-rose-800">
            {item.kind === "manual" ? "Open →" : "Manage →"}
          </Link>
        )}
      </td>
    </tr>
  );
}

export function ChapterStandardsChecklistClient({
  statuses,
  initialOverrides,
}: {
  statuses: Record<string, boolean>;
  initialOverrides: ChecklistOverride[];
}) {
  const [overrides, setOverrides] = useState(
    new Map(initialOverrides.map((o) => [o.code, o]))
  );

  async function handleToggle(code: string, done: boolean) {
    // Optimistic update — this is a simple self-attestation checkbox,
    // not data the rest of the app depends on, so it's fine to update
    // the UI before the PUT resolves.
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(code, { ...(next.get(code) ?? { id: code, code, note: null, updatedAt: new Date() }), done });
      return next;
    });
    await fetch("/api/standards/checklist-override", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, done }),
    });
  }

  // "Done" always means the responsible officer checked it off herself
  // — real data behind a "linked" item is shown as a hint (see
  // DataHint) but never counts as Done on its own. See the `kind` doc
  // comment in lib/chapterStandardsChecklist.ts.
  function isDone(item: ChecklistItem): boolean {
    if (item.kind === "verified") return true;
    return overrides.get(item.code)?.done ?? false;
  }

  function hasData(item: ChecklistItem): boolean {
    return item.statusKey ? statuses[item.statusKey] ?? false : false;
  }

  const { doneCount, trackableCount } = useMemo(() => {
    const trackable = CHECKLIST_ITEMS.filter((i) => i.kind !== "verified");
    const done = trackable.filter((i) => isDone(i)).length;
    return { doneCount: done, trackableCount: trackable.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, overrides]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-sm font-medium text-stone-700">
          {doneCount} of {trackableCount} chapter-tracked credits complete
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-rose-500"
            style={{ width: `${trackableCount ? (doneCount / trackableCount) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-stone-400">
          Nothing here marks itself Done automatically — the officer responsible checks each credit
          off herself once she&apos;s confirmed it&apos;s ready. Items with real data elsewhere in the
          app show a &quot;Data on file&quot; hint to help with that call; National-verified items need
          nothing from the chapter at all and always show as complete.
        </p>
      </div>

      {CHECKLIST_SECTIONS.map((section) => {
        const items = CHECKLIST_ITEMS.filter((i) => i.section === section);
        return (
          <Section
            key={section}
            title={section}
            description={`${items.filter((i) => isDone(i)).length}/${items.length} complete`}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200">
                <thead>
                  <tr>
                    {["Code", "Credit", "Level", "Status", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <ChecklistRow
                      key={item.code}
                      item={item}
                      hasData={hasData(item)}
                      confirmed={isDone(item)}
                      onToggle={handleToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        );
      })}
    </div>
  );
}
