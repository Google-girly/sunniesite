import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import type {
  AlphaOrderRecord,
  CertificationRecord,
  GpaRecord,
  Member,
  MeetingAttendanceRecord,
  Mentorship,
  ProbationRecord,
  ProfessionalDevelopmentAttendee,
  ProfessionalDevelopmentEvent,
  SisterOfTheMonth,
} from "@/app/generated/prisma/client";
import { patchCell, patchCells, readEntry, resolveSheetPath, forceFullCalcOnLoad } from "@/lib/xlsxPatch";
import { addClonedSheet, initialWorkbookState, removeSheet } from "@/lib/xlsxSheetClone";

const TEMPLATE_PATH = path.join(process.cwd(), "lib/templates/standards-forms-template.xlsx");
const CHAPTER = "Chapter: Theta";

// Every roster-table section (B1, B2, B3, D4, D11, and B5's attendee
// grid) follows the same real-template layout: a header row (labels)
// followed by exactly 21 pre-styled data rows. This was verified
// directly against B1's own SUM/AVERAGE formula range (=average(D16:D36)
// — 21 rows) and held consistently across every other section that
// shares this row-block design. A section with more than 21 records in
// a term is a real limitation of the official form itself (same
// situation as Community Service's C3/C4 3-row cap) — extra records are
// left off rather than invented rows for, and callers should split
// across terms/exports the way the chapter already does for every other
// Chapter Standards spreadsheet ("one sheet per term").
const TABLE_ROWS = 21;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface GpaRecordWithMember extends GpaRecord {
  member: Member;
}
interface AlphaOrderRecordWithMember extends AlphaOrderRecord {
  member: Member;
}
interface ProbationRecordWithMember extends ProbationRecord {
  member: Member;
}
interface CertificationRecordWithMember extends CertificationRecord {
  member: Member;
}
interface MentorshipWithMembers extends Mentorship {
  mentee: Member;
  mentor: Member;
}
interface SisterOfTheMonthWithMember extends SisterOfTheMonth {
  member: Member | null;
}
interface ProfessionalDevelopmentEventWithAttendees extends ProfessionalDevelopmentEvent {
  attendees: (ProfessionalDevelopmentAttendee & { member: Member })[];
}

export interface StandardsFormsData {
  term: string; // e.g. "Fall 2026" — used for B1/B2/B3(year)/B4-ish sections
  year: number; // calendar year — used for D9/D10/D11
  gpaRecords: GpaRecordWithMember[];
  mentorships: MentorshipWithMembers[];
  alphaOrderRecords: AlphaOrderRecordWithMember[];
  professionalDevelopmentEvents: ProfessionalDevelopmentEventWithAttendees[];
  probationRecords: ProbationRecordWithMember[];
  meetingAttendanceRecords: MeetingAttendanceRecord[];
  sisterOfTheMonths: SisterOfTheMonthWithMember[];
  certificationRecords: CertificationRecordWithMember[];
}

export async function buildStandardsFormsWorkbook(data: StandardsFormsData): Promise<Uint8Array> {
  const templateBuffer = await fs.readFile(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Section B1 — Member GPAs
  {
    const path = await resolveSheetPath(zip, "Section B1");
    let xml = await readEntry(zip, path);
    xml = patchCells(xml, [
      { ref: "A10", value: CHAPTER },
      { ref: "D10", value: `Term: ${data.term}` },
    ]);
    data.gpaRecords.slice(0, TABLE_ROWS).forEach((record, i) => {
      const row = 16 + i;
      xml = patchCells(xml, [
        { ref: `A${row}`, value: record.member.crossingNumber ?? i + 1 },
        { ref: `B${row}`, value: record.member.name },
        { ref: `C${row}`, value: record.status },
        { ref: `D${row}`, value: record.termGpa != null ? round2(record.termGpa) : null },
        { ref: `E${row}`, value: record.cumGpa != null ? round2(record.cumGpa) : null },
        { ref: `F${row}`, value: record.major },
      ]);
    });
    zip.file(path, xml);
  }

  // Section B2 — Mentorship Program
  {
    const path = await resolveSheetPath(zip, "Section B2");
    let xml = await readEntry(zip, path);
    xml = patchCells(xml, [
      { ref: "A10", value: CHAPTER },
      { ref: "D10", value: `Term: ${data.term}` },
    ]);
    data.mentorships.slice(0, TABLE_ROWS).forEach((pair, i) => {
      const row = 17 + i;
      xml = patchCells(xml, [
        { ref: `A${row}`, value: pair.mentee.crossingNumber ?? i + 1 },
        { ref: `B${row}`, value: pair.mentee.name },
        { ref: `D${row}`, value: pair.mentor.crossingNumber ?? i + 1 },
        { ref: `E${row}`, value: pair.mentor.name },
      ]);
    });
    zip.file(path, xml);
  }

  // Section B3 — Alpha Order Recipients
  {
    const path = await resolveSheetPath(zip, "Section B3");
    let xml = await readEntry(zip, path);
    xml = patchCells(xml, [
      { ref: "A10", value: CHAPTER },
      { ref: "D10", value: `Year: ${data.year}` },
    ]);
    data.alphaOrderRecords.slice(0, TABLE_ROWS).forEach((record, i) => {
      const row = 16 + i;
      xml = patchCells(xml, [
        { ref: `A${row}`, value: record.term },
        { ref: `B${row}`, value: record.member.crossingNumber ?? i + 1 },
        { ref: `C${row}`, value: record.member.name },
        { ref: `D${row}`, value: round2(record.cumGpa) },
        { ref: `E${row}`, value: record.major },
      ]);
    });
    const plaqueRecipient = data.alphaOrderRecords.find((r) => r.isPlaqueRecipient);
    if (plaqueRecipient) {
      xml = patchCells(xml, [
        { ref: "D37", value: plaqueRecipient.member.name },
        {
          ref: "D38",
          value:
            plaqueRecipient.scholarshipAmount != null
              ? round2(plaqueRecipient.scholarshipAmount)
              : 0,
        },
      ]);
    }
    zip.file(path, xml);
  }

  // Section B5 — Professional Development. The real form only fits one
  // event per sheet ("a separate spreadsheet must be submitted for each
  // event attended" — Chapter Standards §B.5), so each event in scope
  // clones the section's sheet rather than sharing it.
  {
    const path = await resolveSheetPath(zip, "Section B5");
    const baseXml = await readEntry(zip, path);
    if (data.professionalDevelopmentEvents.length > 0) {
      const state = initialWorkbookState(["Section B5"], 13, 13);
      for (const event of data.professionalDevelopmentEvents) {
        let xml = baseXml;
        xml = patchCells(xml, [
          { ref: "A10", value: CHAPTER },
          { ref: "C10", value: `Term: ${data.term}` },
          { ref: "C16", value: event.title },
          { ref: "C17", value: event.presentedBy },
          { ref: "C18", value: event.date },
          { ref: "C19", value: event.time },
          { ref: "C20", value: event.location },
        ]);
        event.attendees.slice(0, TABLE_ROWS).forEach((attendee, i) => {
          const row = 23 + i;
          xml = patchCells(xml, [
            { ref: `A${row}`, value: attendee.member.crossingNumber ?? i + 1 },
            { ref: `C${row}`, value: attendee.member.name },
          ]);
        });
        xml = patchCell(xml, "C44", event.attendees.length);
        await addClonedSheet(zip, state, `Section B5 - ${event.title}`, xml);
      }
    }
  }

  // Section D4 — Probation & Suspension
  {
    const path = await resolveSheetPath(zip, "Section D4");
    let xml = await readEntry(zip, path);
    xml = patchCells(xml, [
      { ref: "A10", value: CHAPTER },
      { ref: "C10", value: `Term: ${data.term}` },
    ]);
    data.probationRecords.slice(0, TABLE_ROWS).forEach((record, i) => {
      const row = 16 + i;
      xml = patchCells(xml, [
        { ref: `A${row}`, value: record.member.crossingNumber ?? i + 1 },
        { ref: `B${row}`, value: record.member.name },
        { ref: `C${row}`, value: record.status },
        {
          ref: `D${row}`,
          value: [record.dateInEffectStart, record.dateInEffectEnd].filter(Boolean).join(" - "),
        },
        { ref: `E${row}`, value: record.offense },
        { ref: `F${row}`, value: record.additionalSanctions },
      ]);
    });
    zip.file(path, xml);
  }

  // Section D9 — General Meeting Attendance (fixed 10 pre-numbered rows)
  {
    const path = await resolveSheetPath(zip, "Section D9");
    let xml = await readEntry(zip, path);
    xml = patchCells(xml, [
      { ref: "A10", value: CHAPTER },
      { ref: "D10", value: `Term: ${data.term}` },
    ]);
    for (const record of data.meetingAttendanceRecords) {
      if (record.meetingNumber < 1 || record.meetingNumber > 10) continue;
      const row = 17 + record.meetingNumber;
      xml = patchCells(xml, [
        { ref: `B${row}`, value: record.date },
        { ref: `C${row}`, value: record.activesAttended },
        { ref: `D${row}`, value: record.quorumMet == null ? null : record.quorumMet ? "Yes" : "No" },
        { ref: `E${row}`, value: record.officersAttended },
        { ref: `F${row}`, value: record.otherAttendees },
      ]);
    }
    zip.file(path, xml);
  }

  // Section D10 — Sister of the Month (fixed Sept-June rows)
  {
    const path = await resolveSheetPath(zip, "Section D10");
    let xml = await readEntry(zip, path);
    xml = patchCells(xml, [
      { ref: "A10", value: CHAPTER },
      { ref: "D10", value: `Year: ${data.year}` },
    ]);
    const monthRow: Record<string, number> = {
      September: 16,
      October: 17,
      November: 18,
      December: 19,
      January: 20,
      February: 21,
      March: 22,
      April: 23,
      May: 24,
      June: 25,
    };
    for (const record of data.sisterOfTheMonths) {
      const row = monthRow[record.month];
      if (!row) continue;
      const value = record.notApplicable ? "N/A" : (record.member?.name ?? null);
      xml = patchCell(xml, `C${row}`, value);
    }
    zip.file(path, xml);
  }

  // Section D11 — CPR & First Aid Certification
  {
    const path = await resolveSheetPath(zip, "Section D11");
    let xml = await readEntry(zip, path);
    xml = patchCells(xml, [
      { ref: "A10", value: CHAPTER },
      { ref: "E10", value: `Year: ${data.year}` },
    ]);
    data.certificationRecords.slice(0, TABLE_ROWS).forEach((record, i) => {
      const row = 16 + i;
      xml = patchCells(xml, [
        { ref: `A${row}`, value: record.issuedDate },
        { ref: `C${row}`, value: record.expirationDate },
        { ref: `D${row}`, value: record.member.name },
      ]);
    });
    zip.file(path, xml);
  }

  // B4/B6 (Study Hours) and C3&C4/C6 (Community Service) aren't this
  // export's job — drop them rather than ship blank sheets a chapter
  // officer might mistake for "nothing logged yet."
  for (const name of ["Section B4", "Section B6", "Section C3 & C4", "Section C6"]) {
    await removeSheet(zip, name);
  }

  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  zip.file("xl/workbook.xml", forceFullCalcOnLoad(workbookXml));

  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function standardsFormsExportFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `chapter-standards-forms-${today}.xlsx`;
}
