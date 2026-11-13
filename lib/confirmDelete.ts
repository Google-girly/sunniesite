// A second layer of friction on every destructive action in the app
// (Aug 2026, on request) — on top of the normal "are you sure" wording,
// deleting anything requires typing the chapter's delete password. This
// is deliberately a client-side speed bump against fat-fingered clicks,
// not a real server-side security boundary — the actual access control
// is lib/permissions.ts's position-based gating on every API route
// (a member who can't reach a module's delete button can't hit its
// DELETE route either way).
//
// Nov 2026 — moved from window.prompt to an in-app dialog
// (components/FeedbackHost.tsx): the password is now masked, a wrong
// password shows an inline error and lets you retry instead of silently
// doing nothing, and the dialog matches the rest of the app. Both
// functions are now async — call sites use `if (!(await confirmDelete(...)))`.
import { requestConfirm } from "@/lib/feedback";

const DELETE_PASSWORD = "1996";

/** Asks for the delete password with `message` as context. Resolves true only if confirmed. */
export function confirmDelete(message: string): Promise<boolean> {
  return requestConfirm({ message, confirmLabel: "Remove", password: DELETE_PASSWORD });
}

// Sept 2026 — Cancel Meeting isn't a delete (the record stays, its
// content just moves to the next meeting), so it shouldn't say
// "Remove" — but it's still consequential enough (real reports/notes/
// attachments get reassigned off of it) to deserve the same speed bump.
export function confirmAction(message: string): Promise<boolean> {
  return requestConfirm({ message, confirmLabel: "Confirm", password: DELETE_PASSWORD });
}
