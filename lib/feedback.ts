// In-app replacement for window.alert / window.prompt (Nov 2026).
//
// A tiny module-level store that components/FeedbackHost.tsx (mounted
// once in app/(app)/layout.tsx) subscribes to and renders. Callers
// never touch React state — they just call showError()/showToast() or
// await requestConfirm(), same as they used to call alert()/prompt().
// Browser-only: every caller is an event handler in a client component.

export type ToastKind = "error" | "success" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  /** When set, the dialog asks for this password and won't confirm until it matches. */
  password?: string;
  resolve: (ok: boolean) => void;
}

interface FeedbackState {
  toasts: Toast[];
  confirm: ConfirmRequest | null;
}

let state: FeedbackState = { toasts: [], confirm: null };
const listeners = new Set<() => void>();
let nextId = 1;

function setState(next: FeedbackState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeFeedback(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFeedbackState() {
  return state;
}

export function dismissToast(id: number) {
  setState({ ...state, toasts: state.toasts.filter((t) => t.id !== id) });
}

export function showToast(message: string, kind: ToastKind = "info") {
  const id = nextId++;
  setState({ ...state, toasts: [...state.toasts, { id, kind, message }] });
  // Errors stay a bit longer — they're the ones people need to read.
  setTimeout(() => dismissToast(id), kind === "error" ? 8000 : 4000);
}

/** Drop-in replacement for the old `alert(errorMessage)` calls. */
export function showError(message: unknown) {
  showToast(message instanceof Error ? message.message : String(message), "error");
}

export function requestConfirm(opts: {
  message: string;
  confirmLabel?: string;
  password?: string;
}): Promise<boolean> {
  // A second request while one is open cancels the first rather than stacking.
  state.confirm?.resolve(false);
  return new Promise((resolve) => {
    setState({
      ...state,
      confirm: {
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? "Confirm",
        password: opts.password,
        resolve: (ok) => {
          setState({ ...state, confirm: null });
          resolve(ok);
        },
      },
    });
  });
}
