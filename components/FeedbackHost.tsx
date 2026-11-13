"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  dismissToast,
  getFeedbackState,
  subscribeFeedback,
  type ConfirmRequest,
} from "@/lib/feedback";

// Renders the toasts and confirm dialog requested through lib/feedback.ts.
// Mounted once in app/(app)/layout.tsx.
export function FeedbackHost() {
  const state = useSyncExternalStore(subscribeFeedback, getFeedbackState, getFeedbackState);

  return (
    <>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {state.toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.kind === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : t.kind === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-stone-200 bg-white text-stone-800"
            }`}
          >
            <p className="flex-1 whitespace-pre-line">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              className="text-current opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {state.confirm && <ConfirmDialog key={state.confirm.message} request={state.confirm} />}
    </>
  );
}

function ConfirmDialog({ request }: { request: ConfirmRequest }) {
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (request.password ? inputRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") request.resolve(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (request.password && password !== request.password) {
      setWrong(true);
      inputRef.current?.select();
      return;
    }
    request.resolve(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) request.resolve(false);
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-message"
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
      >
        <p id="confirm-dialog-message" className="text-sm text-stone-800">
          {request.message}
        </p>
        {request.password && (
          <div className="mt-4">
            <label htmlFor="confirm-dialog-password" className="block text-xs font-medium text-stone-600">
              Confirmation password
            </label>
            <input
              id="confirm-dialog-password"
              ref={inputRef}
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setWrong(false);
              }}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
            {wrong && (
              <p className="mt-1 text-xs text-red-600">Wrong password — try again, or cancel.</p>
            )}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => request.resolve(false)}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="submit"
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            {request.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
