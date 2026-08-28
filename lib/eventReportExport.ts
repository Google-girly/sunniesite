// Builds the real national "Event Report" form (word/document.xml body
// built fresh each export, header/fonts/media/theme/styles reused as-is
// from lib/templates/event-report-template.docx — sourced from "Event
// Report .docx", cross-checked against the authoritative "SON Event
// Report.pdf"). Unlike lib/meetingMinutesExport.ts, this isn't surgical
// patching of existing placeholder runs: the source .docx's body is a
// thin, inconsistently-structured auto-conversion (combined
// "Signature Date :" and "Printed Name Title/Office :" single-run
// fields, no "Standard Being Fulfilled" line at all), so it's simpler
// and more robust to keep only the letterhead (header1.xml + its own
// image/fonts, referenced via document.xml's existing rId7) and
// generate the whole body's paragraphs directly, in the master PDF's
// field order — including the "Standard Being Fulfilled" field the
// source .docx was missing. The shared paragraph/signature primitives
// live in lib/docxLetterhead.ts, reused by every other "Official
// Letterhead" Chapter Standards export too (lib/standardsFormsLetters.ts).
import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import type { EventReport } from "@/app/generated/prisma/client";
import {
  embedSignatureImage,
  fieldParagraph,
  formatDateForDoc,
  italicParagraph,
  sectPr,
  titleParagraph,
  twoFieldParagraph,
  valueRun,
  LABEL_RPR,
  PARA_PR,
} from "@/lib/docxLetterhead";
import { standardLabel } from "@/lib/eventReports";
import { readEntry } from "@/lib/xlsxPatch";

export const TEMPLATE_PATH = path.join(process.cwd(), "lib/templates/event-report-template.docx");

const CERTIFICATION_TEXT =
  "By signing below, I certify that the above information is correct and accurate. I understand " +
  "that if I have acted dishonorably, my Chapter is responsible for any judicial procedures that may rise.";

export async function buildEventReportDocx(report: EventReport): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);
  let xml = await readEntry(zip, "word/document.xml");
  let relsXml = await readEntry(zip, "word/_rels/document.xml.rels");

  const embedded = embedSignatureImage(zip, relsXml, report.signatureImage);
  relsXml = embedded.relsXml;

  const body = [
    titleParagraph("EVENT REPORT"),
    fieldParagraph("Standard Being Fulfilled (section and sub-section): ", standardLabel(report.standardSection)),
    fieldParagraph("Event Name: ", report.eventName),
    fieldParagraph("Hosting Organization: ", report.hostingOrganization),
    twoFieldParagraph("Date: ", formatDateForDoc(report.date), "Length of Time: ", report.lengthOfTime ?? ""),
    fieldParagraph("Location: ", report.location),
    fieldParagraph(
      "Number of Members in Attendance: ",
      report.membersInAttendance != null ? String(report.membersInAttendance) : ""
    ),
    fieldParagraph("Purpose and description of the event: ", report.purpose),
    fieldParagraph("Resources utilized in event: ", report.resourcesUtilized),
    italicParagraph(CERTIFICATION_TEXT),
    `<w:p><w:pPr>${PARA_PR}</w:pPr>` +
      `<w:r><w:rPr>${LABEL_RPR}<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">Signature: </w:t></w:r>` +
      embedded.runXml +
      `<w:r><w:rPr>${LABEL_RPR}<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">      Date: </w:t></w:r>` +
      `${valueRun(formatDateForDoc(report.signedDate))}</w:p>`,
    twoFieldParagraph("Printed Name: ", report.signerName, "Title/Office: ", report.signerTitle ?? ""),
  ].join("");

  xml = xml.replace(/<w:body>[\s\S]*<\/w:body>/, `<w:body>${body}${sectPr()}</w:body>`);

  zip.file("word/document.xml", xml);
  zip.file("word/_rels/document.xml.rels", relsXml);

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function eventReportExportFilename(report: EventReport): string {
  const safeName = report.eventName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `event-report-${report.standardSection}-${safeName || report.id}.docx`;
}
