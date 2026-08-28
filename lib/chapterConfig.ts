// This chapter's identity — the one place to change when a different
// chapter forks this repo. Set these via env vars (see .env.example)
// rather than editing source, so pulling upstream updates never
// conflicts with your chapter's own branding.
//
// All three are read client-side too (Sidebar, login page, the
// Calendar module), so they use the NEXT_PUBLIC_ prefix Next.js
// requires to bundle an env var into browser code. None of them are
// secrets — see lib/calendar.ts for why the calendar id is fine to
// ship to the browser.
export const CHAPTER_ORG_NAME = process.env.NEXT_PUBLIC_CHAPTER_ORG_NAME || "Your Organization";
export const CHAPTER_LABEL = process.env.NEXT_PUBLIC_CHAPTER_LABEL || "Your Chapter";
export const CHAPTER_FULL_NAME = `${CHAPTER_ORG_NAME}, ${CHAPTER_LABEL}`;
export const APP_TITLE = `${CHAPTER_LABEL} Admin`;
