// The chapter's shared Google Calendar (Aug 2026) — a public,
// read-only calendar the President already publishes outside the app;
// this just gives it one central place to check inside the app too,
// rather than a separate bookmark/link everyone has to know about.
// Nothing here talks to a Google API or needs credentials — it's a
// plain <iframe> embed of Google's own public embed page, so it's only
// ever as private as the calendar's own sharing settings already are.
//
// Set via NEXT_PUBLIC_CHAPTER_CALENDAR_ID (see .env.example) — every
// chapter that forks this repo has its own calendar, and since this is
// only ever an <iframe src> the browser already sees, there's no
// reason to hardcode one chapter's id in source.
export const CHAPTER_CALENDAR_ID =
  process.env.NEXT_PUBLIC_CHAPTER_CALENDAR_ID || "";
export const CHAPTER_CALENDAR_TIMEZONE = "America/Los_Angeles";

export type CalendarViewMode = "MONTH" | "WEEK" | "AGENDA";

// Builds the embeddable URL for a given view. `mode=AGENDA` is the
// "what's coming up" list view; MONTH/WEEK are the familiar grid views.
// showPrint/showTabs/showCalendars/showTz trim Google's own chrome down
// since this page already has its own title and there's only one
// calendar to switch between.
export function calendarEmbedUrl(mode: CalendarViewMode = "MONTH"): string {
  const params = new URLSearchParams({
    src: CHAPTER_CALENDAR_ID,
    ctz: CHAPTER_CALENDAR_TIMEZONE,
    mode,
    showPrint: "0",
    showTabs: "0",
    showCalendars: "0",
    showTz: "0",
  });
  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}
