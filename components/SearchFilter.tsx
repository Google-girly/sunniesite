"use client";

// Name filter above the long per-member tables (Roster, Fines, Study
// Hours, Community Service) — Nov 2026. Pure client-side filtering over
// rows the page already has; nothing is refetched.

/** Case-insensitive "does any of these fields contain the query". Empty query matches everything. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export function SearchFilter({
  value,
  onChange,
  shown,
  total,
  placeholder = "Filter by name or position…",
}: {
  value: string;
  onChange: (value: string) => void;
  shown: number;
  total: number;
  placeholder?: string;
}) {
  // A member viewing only her own row (self-service modules) has nothing to filter.
  if (total < 2) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <input
        type="search"
        aria-label="Filter members"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full max-w-xs rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
      />
      {value.trim() && (
        <p className="text-xs text-stone-500">
          Showing {shown} of {total}
          {shown === 0 && (
            <>
              {" "}&middot;{" "}
              <button onClick={() => onChange("")} className="text-burgundy-600 hover:text-burgundy-800">
                Clear
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
