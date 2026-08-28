// Shown instead of a locked module's real content — see
// lib/session.ts requirePageAccess(). Deliberately not a redirect: a
// clear "here's why, here's who to ask" beats an unexplained bounce
// back to the dashboard.
export function NotAuthorized({ moduleTitle, positions }: { moduleTitle: string; positions: string[] }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
      <p className="text-lg font-semibold text-stone-900">You don&apos;t have access to {moduleTitle}</p>
      <p className="mt-2 text-sm text-stone-500">
        This is restricted to {positions.length > 0 ? positions.join(" or ") : "specific officers"} and the
        President. If that should be you, ask the President to update your position from Manage Officers
        &amp; Logins.
      </p>
    </div>
  );
}
