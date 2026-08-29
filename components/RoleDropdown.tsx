"use client";

import { useEffect, useRef, useState } from "react";
import { OFFICER_POSITIONS } from "@/lib/positions";

// Multi-select-checkboxes-in-a-dropdown for picking officer position(s)
// — originally built for Manage Officers & Logins
// (app/(app)/officers/OfficersClient.tsx), pulled out here (Aug 2026)
// so /signup can use the exact same picker: "for the roles in sign-up,
// they should be able to choose multiple."
export function RoleDropdown({
  value,
  onChange,
  emptyLabel = "General member",
}: {
  value: string[];
  onChange: (roles: string[]) => void;
  /** Placeholder shown when nothing's selected — "General member" on Officers, "Select position(s)" on Signup. */
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleRole(role: string) {
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full min-w-64 items-center justify-between rounded-md border border-stone-300 bg-white px-2 py-1.5 text-left text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
      >
        <span className={value.length > 0 ? "text-stone-900" : "text-stone-400"}>
          {value.length > 0 ? value.join(", ") : emptyLabel}
        </span>
        <span className="ml-2 shrink-0 text-stone-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full min-w-64 overflow-y-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg">
          {OFFICER_POSITIONS.map((role) => (
            <label key={role} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-stone-50">
              <input
                type="checkbox"
                checked={value.includes(role)}
                onChange={() => toggleRole(role)}
                className="h-4 w-4 rounded border-stone-300 text-burgundy-600 focus:ring-burgundy-400"
              />
              {role}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
