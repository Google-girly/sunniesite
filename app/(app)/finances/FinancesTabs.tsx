"use client";

import { useState } from "react";

export type FinancesTab = {
  id: string;
  label: string;
  /** Small count pill next to the label, e.g. budgets waiting on approval. Hidden when 0. */
  badge?: number;
  content: React.ReactNode;
};

// Splits Chapter Finances into Money In / Money Out / Starting Balance
// so the Treasurer sees one job at a time instead of one long scroll.
// The open tab is mirrored into ?tab= (page.tsx reads it back as
// `initialTab`) so a refresh or a shared link lands on the same tab.
export function FinancesTabs({
  tabs,
  initialTab,
  awaitingApproval,
}: {
  tabs: FinancesTab[];
  initialTab?: string;
  awaitingApproval: number;
}) {
  const [active, setActive] = useState(initialTab ?? tabs[0].id);

  function select(id: string) {
    setActive(id);
    window.history.replaceState(null, "", `?tab=${id}`);
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      {awaitingApproval > 0 && active !== "money-out" && (
        <button
          onClick={() => select("money-out")}
          className="mb-4 flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 hover:bg-amber-100"
        >
          <span>
            <strong>{awaitingApproval}</strong> event budget{awaitingApproval === 1 ? " is" : "s are"} waiting for
            approval and not counted in the balance yet.
          </span>
          <span className="shrink-0 font-medium">Review →</span>
        </button>
      )}

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-stone-200">
        {tabs.map((t) => {
          const selected = t.id === current.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => select(t.id)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
                selected
                  ? "border-burgundy-600 text-burgundy-700"
                  : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              {t.label}
              {!!t.badge && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Every panel stays mounted (just hidden) so a half-filled form
          survives switching tabs. */}
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={t.id !== current.id} className="pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}
