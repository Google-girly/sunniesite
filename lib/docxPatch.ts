// Shared "surgical XML edit" helpers for filling in a real .docx
// template — the WordprocessingML equivalent of lib/xlsxPatch.ts's
// approach for spreadsheets, and for the same reason: round-tripping a
// Word document through a full parsing library risks silently mangling
// formatting elsewhere in the file. A .docx is a zip of XML parts just
// like a .xlsx (see lib/xlsxPatch.ts's readEntry/escapeXmlText, reused
// here directly), but the part that matters is word/document.xml, and
// its structure is paragraphs (<w:p>) containing runs (<w:r>) containing
// text (<w:t>) — not cells in a grid.
import { escapeXmlText } from "@/lib/xlsxPatch";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Replaces the text content of the single <w:t> run whose content
// exactly equals `anchorText` — used for standalone single-run fields
// like the header date/time (see lib/meetingMinutesExport.ts). Throws
// if the template doesn't have that exact text, since a silent no-op
// would mean a date quietly failed to fill in.
export function replaceRunText(xml: string, anchorText: string, newText: string): string {
  const escapedAnchor = escapeRegExp(escapeXmlText(anchorText));
  const re = new RegExp(`(<w:t[^>]*>)${escapedAnchor}(</w:t>)`);
  if (!re.test(xml)) {
    throw new Error(`Template is missing expected text "${anchorText}".`);
  }
  return xml.replace(re, `$1${escapeXmlText(newText)}$2`);
}

// Inserts raw paragraph XML (one or more <w:p>...</w:p> blocks,
// concatenated) immediately after the paragraph that contains a run
// whose text exactly equals `anchorText`. Paragraphs never nest in
// WordprocessingML, so "the next </w:p> after the anchor" reliably closes
// the anchor's own paragraph.
export function insertParagraphsAfter(xml: string, anchorText: string, paragraphsXml: string): string {
  const escapedAnchor = escapeRegExp(escapeXmlText(anchorText));
  const re = new RegExp(`<w:t[^>]*>${escapedAnchor}</w:t>`);
  const match = re.exec(xml);
  if (!match) {
    throw new Error(`Template is missing expected text "${anchorText}".`);
  }
  const closeIdx = xml.indexOf("</w:p>", match.index);
  if (closeIdx === -1) {
    throw new Error(`Template's paragraph for "${anchorText}" is missing a closing tag.`);
  }
  const insertAt = closeIdx + "</w:p>".length;
  return xml.slice(0, insertAt) + paragraphsXml + xml.slice(insertAt);
}

// Inserts a whole new run (runXml, e.g. "<w:r>...<w:t>...</w:t></w:r>")
// immediately after the run whose text exactly equals `labelAnchorText`
// — used for fields like "Date: " that have nothing after the label at
// all (not even an empty placeholder run to overwrite via
// replaceRunText), so filling in a value means adding a run, not
// editing one.
export function insertRunAfterLabel(xml: string, labelAnchorText: string, runXml: string): string {
  const escapedLabel = escapeRegExp(escapeXmlText(labelAnchorText));
  const re = new RegExp(`<w:t[^>]*>${escapedLabel}</w:t>`);
  const match = re.exec(xml);
  if (!match) {
    throw new Error(`Template is missing expected text "${labelAnchorText}".`);
  }
  const runEnd = xml.indexOf("</w:r>", match.index);
  if (runEnd === -1) {
    throw new Error(`Template's run for "${labelAnchorText}" is missing a closing tag.`);
  }
  const insertAt = runEnd + "</w:r>".length;
  return xml.slice(0, insertAt) + runXml + xml.slice(insertAt);
}

// Fills in the "()" placeholder that follows a label run, within that
// label's own paragraph — used for the officer-report headings in
// "Minutes Template.docx", where each heading is split across (at
// least) two runs: a label run ("President ") and a separate,
// differently-colored "()" run right after it in the same paragraph,
// rather than one single "Label ()" run. Scoping the search to between
// the label and the paragraph's closing tag (rather than searching the
// whole document for the first "()") matters because "()" on its own
// isn't unique — every officer heading has one.
export function fillEmptyParensAfter(xml: string, labelAnchorText: string, name: string): string {
  const escapedLabel = escapeRegExp(escapeXmlText(labelAnchorText));
  const labelRe = new RegExp(`<w:t[^>]*>${escapedLabel}</w:t>`);
  const labelMatch = labelRe.exec(xml);
  if (!labelMatch) {
    throw new Error(`Template is missing expected text "${labelAnchorText}".`);
  }
  const labelEnd = labelMatch.index + labelMatch[0].length;
  const pEnd = xml.indexOf("</w:p>", labelEnd);
  if (pEnd === -1) {
    throw new Error(`Template's paragraph for "${labelAnchorText}" is missing a closing tag.`);
  }

  const parensRe = /(<w:t[^>]*>)([^<]*)\(\)([^<]*)(<\/w:t>)/;
  const scoped = xml.slice(labelEnd, pEnd);
  if (!parensRe.test(scoped)) {
    throw new Error(`Template's "${labelAnchorText}" paragraph is missing its "()" placeholder.`);
  }
  const filled = scoped.replace(
    parensRe,
    (_match, open: string, pre: string, post: string, close: string) =>
      `${open}${pre}(${escapeXmlText(name)})${post}${close}`
  );

  return xml.slice(0, labelEnd) + filled + xml.slice(pEnd);
}

// Empty table cells in this template are a run with no <w:t> at all —
// same "nothing to overwrite" situation insertRunAfterLabel handles for
// a single label, but here there's a whole run of blank cells with no
// text to tell them apart, so they can only be targeted by *position*:
// the Nth empty cell after the header, not by content. Fills empty cells
// found between `headerAnchorText` and the next </w:tbl>, in document
// order, leaving any cells beyond `values.length` untouched (rather than
// failing) — the table itself is a fixed size grid the template ships
// with, so more values than fillable cells is a real capacity limit, not
// a bug.
//
// `stride` lets a caller target only every Nth empty cell instead of
// every one — e.g. the Active Roster table is Name | Email per row (2
// empty cells per row), and for now only the Name column gets filled
// (see lib/meetingMinutesExport.ts), so stride=2 fills cell 0, skips
// cell 1, fills cell 2, skips cell 3, ... leaving the skipped cells
// blank rather than consuming values for them.
export function fillTableCellsAfterHeader(
  xml: string,
  headerAnchorText: string,
  values: string[],
  stride = 1
): string {
  const escapedHeader = escapeRegExp(escapeXmlText(headerAnchorText));
  const headerRe = new RegExp(`<w:t[^>]*>${escapedHeader}</w:t>`);
  const headerMatch = headerRe.exec(xml);
  if (!headerMatch) {
    throw new Error(`Template is missing expected text "${headerAnchorText}".`);
  }
  const headerEnd = headerMatch.index + headerMatch[0].length;
  const tableEnd = xml.indexOf("</w:tbl>", headerEnd);
  if (tableEnd === -1) {
    throw new Error(`Template's table for "${headerAnchorText}" is missing a closing tag.`);
  }

  const emptyRunRe =
    /<w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000"><w:rPr><w:rtl w:val="0"\/><\/w:rPr><\/w:r>/g;
  const scoped = xml.slice(headerEnd, tableEnd);

  let valueIndex = 0;
  let cellIndex = 0;
  const filled = scoped.replace(emptyRunRe, (match) => {
    const isTargetSlot = cellIndex % stride === 0;
    cellIndex++;
    if (!isTargetSlot || valueIndex >= values.length) return match; // skipped slot, or out of values — leave blank
    const value = values[valueIndex++];
    return (
      `<w:r><w:rPr><w:rFonts w:ascii="Georgia" w:cs="Georgia" w:eastAsia="Georgia" w:hAnsi="Georgia"/><w:rtl w:val="0"/></w:rPr>` +
      `<w:t xml:space="preserve">${escapeXmlText(value)}</w:t></w:r>`
    );
  });

  return xml.slice(0, headerEnd) + filled + xml.slice(tableEnd);
}
