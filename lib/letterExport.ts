import type { Letter } from "@/app/generated/prisma/client";
import { buildLetterheadDocx, fieldParagraph, formatDateForDoc, PARA_PR, twoFieldParagraph, valueRun } from "@/lib/docxLetterhead";
import { letterTitle } from "@/lib/letters";

// A bare paragraph, no "Label: " prefix — just the text itself, same
// styling as a fieldParagraph's value. Used below for a letter type that
// doesn't want its body labeled "Purpose:".
function plainParagraph(text: string): string {
  return `<w:p><w:pPr>${PARA_PR}</w:pPr>${valueRun(text)}</w:p>`;
}

// General-purpose letterhead letter export — see lib/letters.ts for the
// type list and lib/docxLetterhead.ts for the shared crest/letterhead
// builder (the same one lib/standardsFormsLetters.ts uses).
export async function buildLetterDocx(letter: Letter): Promise<Uint8Array> {
  // Aug 2026 — "for the letter of excuse I dont want it to say purpose
  // or prepared by." Scoped to just this one letter type: it reads like
  // an actual letter (Date, then the body as plain text) rather than a
  // labeled form; every other letter type keeps the original
  // Date/Prepared By + "Purpose:" layout.
  const isLetterOfExcuse = letter.type === "Letter of Excuse";

  const body = [
    isLetterOfExcuse
      ? fieldParagraph("Date: ", formatDateForDoc(letter.date))
      : twoFieldParagraph("Date: ", formatDateForDoc(letter.date), "Prepared By: ", letter.createdByName),
    ...(letter.recipientName ? [fieldParagraph("To: ", letter.recipientName)] : []),
    isLetterOfExcuse ? plainParagraph(letter.purpose) : fieldParagraph("Purpose: ", letter.purpose),
  ];
  return buildLetterheadDocx({ title: letterTitle(letter).toUpperCase(), bodyParagraphs: body });
}

export function letterFilename(letter: Letter): string {
  const slug = letterTitle(letter)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "letter"}-${letter.date}.docx`;
}
