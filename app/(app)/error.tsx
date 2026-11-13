"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

// Friendly fallback for an unexpected server/render error on any page
// under the app shell (Nov 2026) — keeps the sidebar usable instead of
// Next's default error screen. This Next version passes `retry`, not
// `reset` (see node_modules/next/dist/docs/.../file-conventions/error.md).
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 p-6">
      <h1 className="text-lg font-semibold text-red-900">Something went wrong loading this page</h1>
      <p className="mt-2 text-sm text-red-800">
        Nothing you entered was lost unless you were in the middle of saving. Try again — if it keeps
        happening, let the President know what you were doing
        {error.digest ? ` and mention code ${error.digest}` : ""}.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => retry()}
          className="rounded-md bg-burgundy-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-burgundy-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
