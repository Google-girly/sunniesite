// Shared building blocks for docx exports that reuse the chapter's real
// "Sigma Omega Nu Official Letterhead" (crest + fonts + header, from
// lib/templates/event-report-template.docx — the one real letterhead
// asset in the repo, reused as-is rather than duplicated as a second
// binary since only its header/fonts/rels ever get read, never its
// original body). Originally built for lib/eventReportExport.ts; pulled
// out here once lib/standardsFormsLetters.ts needed the exact same
// paragraph/signature primitives for every "submitted on Official
// Letterhead" Chapter Standards credit (see MODULES.md — Chapter
// Standards §I.2 is the reason so many credits share this one format).
import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { escapeXmlText, readEntry } from "@/lib/xlsxPatch";

// The one real letterhead asset in the repo (crest + fonts + "SIGMA
// OMEGA NU / LATINA INTEREST SORORITY / ESTABLISHED 1996" header),
// originally sourced for the Event Report form — reused as-is for every
// other Official Letterhead export rather than duplicated as a second
// ~580KB binary, since only its header/fonts/rels/theme/styles ever get
// read, never its original Event Report body.
const LETTERHEAD_TEMPLATE_PATH = path.join(process.cwd(), "lib/templates/event-report-template.docx");

export const LABEL_RPR =
  `<w:rFonts w:ascii="Garamond" w:cs="Garamond" w:eastAsia="Garamond" w:hAnsi="Garamond"/>` +
  `<w:b w:val="1"/><w:bCs w:val="1"/><w:sz w:val="24"/><w:szCs w:val="24"/>`;
export const VALUE_RPR =
  `<w:rFonts w:ascii="Garamond" w:cs="Garamond" w:eastAsia="Garamond" w:hAnsi="Garamond"/>` +
  `<w:sz w:val="24"/><w:szCs w:val="24"/>`;
export const ITALIC_RPR =
  `<w:rFonts w:ascii="Garamond" w:cs="Garamond" w:eastAsia="Garamond" w:hAnsi="Garamond"/>` +
  `<w:i w:val="1"/><w:iCs w:val="1"/><w:sz w:val="24"/><w:szCs w:val="24"/>`;
export const PARA_PR = `<w:widowControl w:val="0"/><w:spacing w:before="200" w:line="240" w:lineRule="auto"/>`;

export function valueRun(value: string | null | undefined): string {
  const lines = (value ?? "").split("\n").map(escapeXmlText);
  const text = lines.map((l) => `<w:t xml:space="preserve">${l}</w:t>`).join("<w:br/>");
  return `<w:r><w:rPr>${VALUE_RPR}<w:rtl w:val="0"/></w:rPr>${text}</w:r>`;
}

// One "Label: value" line — the real Event Report form's own
// convention, reused for every letter since it reads just as clearly
// there.
export function fieldParagraph(label: string, value: string | null | undefined): string {
  return (
    `<w:p><w:pPr>${PARA_PR}</w:pPr>` +
    `<w:r><w:rPr>${LABEL_RPR}<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">${escapeXmlText(label)}</w:t></w:r>` +
    `${valueRun(value)}</w:p>`
  );
}

// Two fields sharing one line, e.g. "Date: ___      Length of Time: ___".
export function twoFieldParagraph(labelA: string, valueA: string, labelB: string, valueB: string): string {
  return (
    `<w:p><w:pPr>${PARA_PR}</w:pPr>` +
    `<w:r><w:rPr>${LABEL_RPR}<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">${escapeXmlText(labelA)}</w:t></w:r>` +
    `${valueRun(valueA)}` +
    `<w:r><w:rPr>${LABEL_RPR}<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">      ${escapeXmlText(labelB)}</w:t></w:r>` +
    `${valueRun(valueB)}</w:p>`
  );
}

// A visual gap between repeated entries in a letter (e.g. one per
// Officer Transition row) — Word's own equivalent of a blank line.
export function blankParagraph(): string {
  return "<w:p/>";
}

export function italicParagraph(text: string): string {
  return (
    `<w:p><w:pPr>${PARA_PR}</w:pPr>` +
    `<w:r><w:rPr>${ITALIC_RPR}<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r></w:p>`
  );
}

// Centered bold document title, e.g. "EVENT REPORT" or "OFFICER
// TRANSITION LETTER" — same style as the real form's own title.
export function titleParagraph(text: string): string {
  return (
    `<w:p><w:pPr><w:widowControl w:val="0"/><w:jc w:val="center"/>` +
    `<w:rPr><w:rFonts w:ascii="Garamond" w:cs="Garamond" w:eastAsia="Garamond" w:hAnsi="Garamond"/>` +
    `<w:b w:val="1"/><w:bCs w:val="1"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Garamond" w:cs="Garamond" w:eastAsia="Garamond" w:hAnsi="Garamond"/>` +
    `<w:b w:val="1"/><w:bCs w:val="1"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:rtl w:val="0"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r></w:p>`
  );
}

// Single-section sectPr as a direct child of <w:body> — headerReference
// keeps the crest/letterhead. Left/right/bottom margins are 1440
// (a standard 1"), matching the source template's OWN body sectPr
// exactly (confirmed by reading word/document.xml straight out of the
// shipped .docx). An earlier "fix" here shrank both to 791/791 twips on
// the mistaken belief that the template's real margins were asymmetric
// (537.6/1044) — they never were; that number came from somewhere else
// entirely. Shrinking the margins moved the *column* (the left-margin
// anchor every header/body element measures from) closer to the page
// edge, and the crest image in word/header1.xml is positioned with a
// large NEGATIVE offset from that column (`wp:posOffset>-771523</`,
// calibrated for the template's real 1440-twip margin) — so at
// 791 twips the crest's absolute X position went negative and the
// image hung off the left edge of the page, which reads as "still off
// center, to the left" even though the *text* margins were technically
// symmetric. Matching the template's real left/right 1440 keeps the
// crest at its designed position and centers the page for real.
//
// TOP margin is deliberately NOT 1440 like the rest — that's the actual
// cause of the header/body text overlap: word/header1.xml's own content
// (the crest, `behindDoc="1"` floating `wp:anchor`'d to the "SIGMA OMEGA
// NU" paragraph at `wp:posOffset>-200740<` vertically, cy="1576101" EMU
// ≈ 1.72" tall, plus two more text lines below it) extends roughly
// 0.3"-2.0" down the page — well past where a 1" top margin lets body
// text start printing. `w:header="720"` (0.5") is only a *minimum*
// distance; Word doesn't push the body down to clear whatever the
// header actually renders at, so the body's own top margin has to be
// generous enough on its own. 3312 twips (2.3") clears the crest's
// estimated bottom edge with real buffer — computed from the header's
// XML, not visually confirmed (no Word/LibreOffice available in this
// environment), so a fresh export is still worth a look.
export function sectPr(headerRelId = "rId7"): string {
  return (
    `<w:sectPr><w:headerReference r:id="${headerRelId}" w:type="default"/>` +
    `<w:pgSz w:h="15840" w:w="12240" w:orient="portrait"/>` +
    `<w:pgMar w:bottom="1440" w:top="3312" w:left="1440" w:right="1440" w:header="720" w:footer="720"/></w:sectPr>`
  );
}

// PNG's IHDR chunk (width/height as big-endian uint32) starts right
// after the 8-byte signature + 8-byte chunk header — no image library
// needed just to read two integers back out.
export function pngDimensions(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const EMU_PER_INCH = 914400;
const SIGNATURE_MAX_WIDTH_EMU = 2 * EMU_PER_INCH;
const SIGNATURE_MAX_HEIGHT_EMU = 0.8 * EMU_PER_INCH;

// An inline <w:drawing> run embedding an already-added image
// relationship, sized to fit within a max box while preserving the
// PNG's own aspect ratio.
export function signatureDrawingXml(pngBytes: Buffer, relationshipId: string): string {
  const { width, height } = pngDimensions(pngBytes);
  const aspect = width / height;
  let cx = SIGNATURE_MAX_WIDTH_EMU;
  let cy = Math.round(cx / aspect);
  if (cy > SIGNATURE_MAX_HEIGHT_EMU) {
    cy = SIGNATURE_MAX_HEIGHT_EMU;
    cx = Math.round(cy * aspect);
  }
  return (
    `<w:r><w:rPr><w:rtl w:val="0"/></w:rPr><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="100" name="Signature"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="100" name="Signature"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

// Finds the next unused rIdN across every relationship already in the
// rels file (not scoped to one relationship type) — a scoped scan is
// exactly what caused a real rId collision bug while building Meeting
// Minutes (see MODULES.md), so this checks the one authoritative source
// of truth for "already used" instead.
export function nextRelationshipId(relsXml: string): string {
  const used = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const max = used.length ? Math.max(...used) : 0;
  return `rId${max + 1}`;
}

// Adds a signature PNG to the zip + a new image relationship, and
// returns the run XML to drop into the "Signature: " line — or a blank
// run if there's no image yet (not signed). Bundles the
// add-media/add-relationship/build-drawing steps every letter-style
// export needs identically, so a signer field is a one-line addition
// rather than repeating the whole rels-file dance each time.
export function embedSignatureImage(
  zip: JSZip,
  relsXml: string,
  dataUrl: string | null | undefined,
  mediaFilename = "signature.png"
): { relsXml: string; runXml: string } {
  if (!dataUrl) return { relsXml, runXml: valueRun("") };
  const base64 = dataUrl.split(",").pop() ?? "";
  const pngBytes = Buffer.from(base64, "base64");
  const relationshipId = nextRelationshipId(relsXml);
  const newRelsXml = relsXml.replace(
    "</Relationships>",
    `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFilename}"/></Relationships>`
  );
  zip.file(`word/media/${mediaFilename}`, pngBytes);
  return { relsXml: newRelsXml, runXml: signatureDrawingXml(pngBytes, relationshipId) };
}

export function formatDateForDoc(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${Number(month)}/${Number(day)}/${year}`;
}

export interface LetterSignature {
  signerName: string;
  signerTitle?: string | null;
  signedDate?: string | null;
  signatureImage?: string | null;
}

export interface LetterheadSection {
  title: string;
  /** Pre-built paragraph XML (fieldParagraph/twoFieldParagraph/italicParagraph/raw), in order. */
  bodyParagraphs: string[];
  /** Italic certification line shown just above the signature block, if any. */
  certificationText?: string;
  signature?: LetterSignature;
}

// Generic "Official Letterhead" letter builder — every Chapter Standards
// credit whose Documentation line says "on Official Letterhead" (rather
// than a designated national spreadsheet) goes through this, each with
// its own field paragraphs but the same letterhead, title style, and
// signature block. See lib/standardsFormsLetters.ts for the per-credit
// callers.
export async function buildLetterheadDocx(section: LetterheadSection): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(LETTERHEAD_TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);
  let xml = await readEntry(zip, "word/document.xml");
  let relsXml = await readEntry(zip, "word/_rels/document.xml.rels");

  const paragraphs = [titleParagraph(section.title), ...section.bodyParagraphs];

  if (section.certificationText) {
    paragraphs.push(italicParagraph(section.certificationText));
  }
  if (section.signature) {
    const embedded = embedSignatureImage(zip, relsXml, section.signature.signatureImage);
    relsXml = embedded.relsXml;
    paragraphs.push(
      `<w:p><w:pPr>${PARA_PR}</w:pPr>` +
        `<w:r><w:rPr>${LABEL_RPR}<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">Signature: </w:t></w:r>` +
        embedded.runXml +
        `<w:r><w:rPr>${LABEL_RPR}<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">      Date: </w:t></w:r>` +
        `${valueRun(formatDateForDoc(section.signature.signedDate))}</w:p>`
    );
    paragraphs.push(
      twoFieldParagraph(
        "Printed Name: ",
        section.signature.signerName,
        "Title/Office: ",
        section.signature.signerTitle ?? ""
      )
    );
  }

  const body = paragraphs.join("");
  xml = xml.replace(/<w:body>[\s\S]*<\/w:body>/, `<w:body>${body}${sectPr()}</w:body>`);

  zip.file("word/document.xml", xml);
  zip.file("word/_rels/document.xml.rels", relsXml);

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
