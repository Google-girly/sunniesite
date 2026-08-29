// General-purpose "Official Letterhead" letters (Aug 2026) — "a place
// where people can just use the official letter head for whatever they
// need, letter of excuse, active request letter, etc." Every letter is
// logged: date, who created it, and what it was for (`purpose`, printed
// as the letter's body) — see prisma/schema.prisma Letter and
// app/api/letters. Distinct from lib/standardsFormsLetters.ts, which is
// tied to a specific Chapter Standards credit; this is free-form, any
// member, any purpose.
export const LETTER_TYPES = [
  "Letter of Excuse",
  "Active Member Request",
  "Letter of Recommendation",
  "Verification of Membership",
  "Other",
] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

export function isLetterType(value: string): value is LetterType {
  return (LETTER_TYPES as readonly string[]).includes(value);
}

export interface LetterInput {
  type: LetterType;
  typeOther: string | null;
  isDraft: boolean;
  purpose: string;
  recipientName: string | null;
  date: string;
}

// The label actually printed as the letter's title — "Other" pairs with
// the free-text typeOther instead of printing the literal word "Other".
export function letterTitle(letter: { type: string; typeOther: string | null }): string {
  return (letter.type === "Other" ? letter.typeOther : letter.type) || letter.type;
}

// Aug 2026 — "make the letterhead be able to have drafts as well." A
// draft only needs a type picked (plus typeOther, if "Other") —
// purpose/date/recipient can come later. Everything's required again
// once it's not a draft, same as before.
export function parseLetterInput(body: unknown): { data: LetterInput } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;
  const isDraft = b.isDraft === true;

  const type = typeof b.type === "string" ? b.type.trim() : "";
  if (!isLetterType(type)) {
    return { error: "Select a letter type." };
  }
  const typeOther = typeof b.typeOther === "string" ? b.typeOther.trim() : "";
  if (type === "Other" && !typeOther) {
    return { error: "Enter what kind of letter this is." };
  }
  const purpose = typeof b.purpose === "string" ? b.purpose.trim() : "";
  if (!isDraft && !purpose) {
    return { error: "Purpose / letter body is required." };
  }
  const date = typeof b.date === "string" ? b.date.trim() : "";
  if (!isDraft && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "A valid date is required." };
  }
  const recipientName = typeof b.recipientName === "string" ? b.recipientName.trim() : "";

  return {
    data: {
      type,
      typeOther: type === "Other" ? typeOther : null,
      isDraft,
      purpose,
      recipientName: recipientName || null,
      date,
    },
  };
}
