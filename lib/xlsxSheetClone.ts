import JSZip from "jszip";
import { escapeXmlText, readEntry } from "@/lib/xlsxPatch";

// Shared "clone a worksheet N times" helpers — originally written for
// Community Service (one sheet per member) and reused by Study Hours and
// Pledgeship. Registering a brand-new worksheet part means touching the
// three places OOXML tracks a worksheet's existence beyond the worksheet
// XML itself: xl/workbook.xml's <sheets> list, xl/_rels/workbook.xml.rels,
// and [Content_Types].xml.

export function sanitizeSheetName(name: string, used: Set<string>): string {
  // Excel sheet-name rules: 31 chars max, none of : \ / ? * [ ], not blank.
  let base = name.replace(/[:\\/?*[\]]/g, "").trim() || "Sheet";
  base = base.slice(0, 31);
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export interface WorkbookState {
  nextPartNumber: number;
  nextRelId: number;
  nextSheetId: number;
  usedNames: Set<string>;
}

// The template's own next-available part number/rId/sheetId — pass in
// what the template ships with (existing sheet display names, lowercased,
// and one past its highest sheetN.xml/sheetId) so clones start numbering
// right after whatever's already there.
export function initialWorkbookState(
  existingSheetNames: string[],
  startingPartNumber: number,
  startingSheetId: number
): WorkbookState {
  return {
    nextPartNumber: startingPartNumber,
    nextRelId: 1,
    nextSheetId: startingSheetId,
    usedNames: new Set(existingSheetNames.map((n) => n.toLowerCase())),
  };
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function addClonedSheet(
  zip: JSZip,
  state: WorkbookState,
  displayName: string,
  sheetXml: string
): Promise<void> {
  const safeName = sanitizeSheetName(displayName, state.usedNames);
  const partPath = `xl/worksheets/sheet${state.nextPartNumber}.xml`;
  const relId = `rIdClone${state.nextRelId}`;
  const sheetId = state.nextSheetId;
  state.nextPartNumber++;
  state.nextRelId++;
  state.nextSheetId++;

  zip.file(partPath, sheetXml);

  let workbookXml = await readEntry(zip, "xl/workbook.xml");
  workbookXml = workbookXml.replace(
    "</sheets>",
    `<sheet state="visible" name="${escapeXmlAttr(safeName)}" sheetId="${sheetId}" r:id="${relId}"/></sheets>`
  );
  zip.file("xl/workbook.xml", workbookXml);

  let relsXml = await readEntry(zip, "xl/_rels/workbook.xml.rels");
  relsXml = relsXml.replace(
    "</Relationships>",
    `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${state.nextPartNumber - 1}.xml"/></Relationships>`
  );
  zip.file("xl/_rels/workbook.xml.rels", relsXml);

  let contentTypesXml = await readEntry(zip, "[Content_Types].xml");
  contentTypesXml = contentTypesXml.replace(
    "</Types>",
    `<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" PartName="/xl/worksheets/sheet${state.nextPartNumber - 1}.xml"/></Types>`
  );
  zip.file("[Content_Types].xml", contentTypesXml);
}

// The inverse of addClonedSheet — drops a sheet a multi-section template
// ships with but a given export doesn't need (e.g. Study Hours' report
// only wants Section B4/B6 out of the 12-sheet Chapter Standards
// template), removing it from all three OOXML bookkeeping spots plus the
// worksheet part itself.
export async function removeSheet(zip: JSZip, sheetName: string): Promise<void> {
  const workbookXml = await readEntry(zip, "xl/workbook.xml");
  const escapedName = escapeXmlText(sheetName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagMatch = new RegExp(`<sheet\\b[^>]*name="${escapedName}"[^>]*/>`).exec(workbookXml);
  if (!tagMatch) return;
  const relId = /r:id="(rId\w+)"/.exec(tagMatch[0])?.[1];
  zip.file("xl/workbook.xml", workbookXml.replace(tagMatch[0], ""));
  if (!relId) return;

  const relsXml = await readEntry(zip, "xl/_rels/workbook.xml.rels");
  const relMatch = new RegExp(`<Relationship\\b[^>]*Id="${relId}"[^>]*/>`).exec(relsXml);
  if (!relMatch) return;
  const target = /Target="([^"]+)"/.exec(relMatch[0])?.[1];
  zip.file("xl/_rels/workbook.xml.rels", relsXml.replace(relMatch[0], ""));
  if (!target) return;

  const partPath = `xl/${target}`;
  const contentTypesXml = await readEntry(zip, "[Content_Types].xml");
  const overrideMatch = new RegExp(`<Override\\b[^>]*PartName="/${partPath}"[^>]*/>`).exec(
    contentTypesXml
  );
  if (overrideMatch) {
    zip.file("[Content_Types].xml", contentTypesXml.replace(overrideMatch[0], ""));
  }
  zip.remove(partPath);
}
