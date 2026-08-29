// Plain-text extraction for .xlsx, for scripts/rag-ingest.ts — matches
// this codebase's existing habit (see lib/xlsxPatch.ts) of reading .xlsx
// as a zip of XML parts via JSZip rather than pulling in a full workbook
// library, since we only need to read text out, never write back.
import JSZip from "jszip";

export interface XlsxSheet {
  name: string;
  text: string;
}

function textOfTag(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  return [...xml.matchAll(re)].map((m) => m[1]);
}

// xl/sharedStrings.xml: one <si> per unique string, each holding either a
// bare <t> or several <r><t> "rich text" runs — concatenate whichever is
// there. Cell values elsewhere reference these by index (t="s").
function parseSharedStrings(xml: string): string[] {
  const items = textOfTag(xml, "si");
  return items.map((si) => {
    const runs = textOfTag(si, "t");
    return runs.join("").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  });
}

// xl/workbook.xml <sheets><sheet name="..." r:id="rIdN"/></sheets>
// + xl/_rels/workbook.xml.rels <Relationship Id="rIdN" Target="worksheets/sheetN.xml"/>
// — two lookups needed to go from a human sheet name to its worksheet's
// zip entry path.
function parseSheetList(workbookXml: string, relsXml: string): { name: string; target: string }[] {
  const relTarget = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\s+Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relTarget.set(m[1], m[2]);
  }
  const sheets: { name: string; target: string }[] = [];
  for (const m of workbookXml.matchAll(/<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)) {
    const target = relTarget.get(m[2]);
    if (target) sheets.push({ name: m[1], target: `xl/${target.replace(/^\/?xl\//, "")}` });
  }
  return sheets;
}

function cellValue(cellXml: string, sharedStrings: string[]): string {
  const type = /\st="([^"]+)"/.exec(cellXml)?.[1];
  if (type === "inlineStr") {
    return textOfTag(cellXml, "t").join("");
  }
  const raw = /<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1];
  if (raw === undefined) return "";
  if (type === "s") {
    const idx = Number(raw);
    return sharedStrings[idx] ?? "";
  }
  return raw; // numeric, boolean ("0"/"1"), or formula-cached string
}

// One text line per non-empty row, cells joined with " | " — enough
// structure for chunk.ts's paragraph splitter to work with, without
// trying to reproduce the actual grid.
function sheetXmlToText(sheetXml: string, sharedStrings: string[]): string {
  const rows = textOfTag(sheetXml, "row");
  const lines: string[] = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)].map((m) =>
      cellValue(m[0], sharedStrings)
    );
    const line = cells.filter((c) => c.trim().length > 0).join(" | ");
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

export async function extractXlsxSheets(fullPath: string, fileBuffer?: Buffer): Promise<XlsxSheet[]> {
  const fs = await import("node:fs/promises");
  const buffer = fileBuffer ?? (await fs.readFile(fullPath));
  const zip = await JSZip.loadAsync(buffer);

  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsFile ? parseSharedStrings(await sharedStringsFile.async("string")) : [];

  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !relsXml) return [];

  const sheetList = parseSheetList(workbookXml, relsXml);
  const sheets: XlsxSheet[] = [];
  for (const { name, target } of sheetList) {
    const sheetXml = await zip.file(target)?.async("string");
    if (!sheetXml) continue;
    const text = sheetXmlToText(sheetXml, sharedStrings);
    if (text.trim()) sheets.push({ name, text });
  }
  return sheets;
}
