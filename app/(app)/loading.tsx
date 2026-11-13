// Shown instantly while any page under the app shell fetches its data,
// so clicking a sidebar link gives immediate feedback (Nov 2026). The
// sidebar stays put — only <main>'s content is swapped for this.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse">
      <div className="h-7 w-56 rounded bg-stone-200" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-stone-100" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg border border-stone-200 bg-white" />
        ))}
      </div>
    </div>
  );
}
