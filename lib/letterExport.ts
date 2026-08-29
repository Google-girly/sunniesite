import type { Letter } from "@/app/generated/prisma/client";
import { buildLetterheadDocx, fieldParagraph, formatDateForDoc, twoFieldParagraph } from "@/lib/docxLetterhead";
import { letterTitle } from "@/lib/letters";

// General-purpose letterhead letter export — see lib/letters.ts for the
// type list and lib/docxLetterhead.ts for the shared crest/letterhead
// builder (the same one lib/standardsFormsLetters.ts uses).
export async function buildLetterDocx(letter: Letter): Promise<Uint8Array> {
  const body = [
    twoFieldParagraph("Date: ", formatDateForDoc(letter.date), "Prepared By: ", letter.createdByName),
    ...(letter.recipientName ? [fieldParagraph("To: ", letter.recipientName)] : []),
    fieldParagraph("Purpose: ", letter.purpose),
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
