// Shared Meeting Notes constants (Aug 2026) — "space for everyone to
// add to Action Items, Old Business, Reminders, and Announcements,"
// open to every logged-in member rather than gated to a position like
// OfficerReport is. Deliberately doesn't include Adjournment — that
// stays hand-filled, on request, same as Roll Call/Approval of Minutes/
// Agenda already are.
export const MEETING_NOTE_CATEGORIES = [
  "ACTION_ITEM",
  "OLD_BUSINESS",
  "REMINDER",
  "ANNOUNCEMENT",
] as const;

export type MeetingNoteCategory = (typeof MEETING_NOTE_CATEGORIES)[number];

export const MEETING_NOTE_CATEGORY_LABELS: Record<MeetingNoteCategory, string> = {
  ACTION_ITEM: "Action Items",
  OLD_BUSINESS: "Old Business",
  REMINDER: "Reminders",
  ANNOUNCEMENT: "Announcements",
};

export function isMeetingNoteCategory(value: string): value is MeetingNoteCategory {
  return (MEETING_NOTE_CATEGORIES as readonly string[]).includes(value);
}
