// Turns the real generated Meeting Minutes .docx into HTML for printing
// to PDF (Aug 2026 — see lib/htmlToPdf.ts). mammoth.js reads the actual
// docx XML — the crest image, the real "I./A./1." nested numbering, the
// Active Roster and Officer Information tables, bold/link runs — so
// this is a genuine reflection of the document that was generated, not
// a parallel re-implementation of its content.
//
// mammoth intentionally strips most direct formatting (exact fonts,
// sizes, colors) down to semantic HTML (<strong>, <ol>, <table>) — the
// CSS below rebuilds the visual identity that matters: the template's
// own Georgia font, and each list level's real numbering format (read
// straight out of the template's numbering.xml — abstractNumId 1: ilvl0
// upperRoman, ilvl1 upperLetter, ilvl2 decimal, ilvl3 lowerLetter — CSS
// can't reach any deeper than this template's content ever does).
import mammoth from "mammoth";

const STYLE = `
  @page { size: letter; margin: 0.75in 0.9in; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.4;
    color: #1a1a1a;
    max-width: 7.5in;
    margin: 0 auto;
  }
  p { margin: 0.4em 0; }
  strong { font-weight: 700; }
  a { color: #1a1a1a; }
  ol { margin: 0.3em 0; padding-left: 1.6em; }
  ol { list-style-type: upper-roman; }
  ol ol { list-style-type: upper-alpha; }
  ol ol ol { list-style-type: decimal; }
  ol ol ol ol { list-style-type: lower-alpha; }
  ol ol ol ol ol { list-style-type: decimal; }
  li { margin: 0.15em 0; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
  th, td { border: 1px solid #999; padding: 4px 8px; text-align: left; font-weight: normal; vertical-align: top; }
  thead th:first-child[colspan] { text-align: center; background: #f3ede9; }
  img { max-width: 3in; display: block; margin: 0 auto 0.5em; }
`;

export async function buildMeetingMinutesHtml(docxBytes: Uint8Array): Promise<string> {
  const { value: bodyHtml } = await mammoth.convertToHtml({ buffer: Buffer.from(docxBytes) });
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${bodyHtml}</body></html>`;
}
