// A second layer of friction on every destructive action in the app
// (Aug 2026, on request) — on top of the normal "are you sure" wording,
// deleting anything requires typing the chapter's delete password. This
// is deliberately a client-side speed bump against fat-fingered clicks,
// not a real server-side security boundary — the actual access control
// is lib/permissions.ts's position-based gating on every API route
// (a member who can't reach a module's delete button can't hit its
// DELETE route either way). Uses window.prompt rather than two separate
// dialogs (a plain confirm, then a password prompt) — typing the
// password back correctly already doubles as "yes, I mean it."
const DELETE_PASSWORD = "1996";

/** Prompts for the delete password with `message` as context. True only if it matches. */
export function confirmDelete(message: string): boolean {
  const input = window.prompt(`${message}\n\nEnter the delete password to confirm.`);
  if (input === null) return false;
  return input === DELETE_PASSWORD;
}
