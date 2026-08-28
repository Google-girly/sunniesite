"use client";

import { useState } from "react";
import { calendarEmbedUrl, type CalendarViewMode } from "@/lib/calendar";

const VIEWS: { mode: CalendarViewMode; label: string }[] = [
  { mode: "AGENDA", label: "Upcoming" },
  { mode: "MONTH", label: "Month" },
  { mode: "WEEK", label: "Week" },
];

export function CalendarEmbed() {
  const [mode, setMode] = useState<CalendarViewMode>("AGENDA");

  return (
    <div>
      <div className="flex gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.mode}
            onClick={() => setMode(v.mode)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === v.mode
                ? "bg-burgundy-600 text-white"
                : "border border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-white">
        <iframe
          key={mode}
          src={calendarEmbedUrl(mode)}
          title="Chapter Calendar"
          className="h-[720px] w-full"
          frameBorder="0"
          scrolling="no"
        />
      </div>
    </div>
  );
}
