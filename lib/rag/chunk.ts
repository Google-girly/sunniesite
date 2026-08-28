// Paragraph-aware chunking for RAG ingestion (scripts/rag-ingest.ts). Plain
// word-count is used as a token-count stand-in — close enough for sizing
// chunks and avoids pulling in a real tokenizer just for this.
//
// A "section" heading is tracked best-effort as the nearest preceding line
// that looks like one of these governing documents' own headers (ARTICLE
// I, Section 4.02, all-caps titles, etc.) — not every source PDF has clean
// enough extracted text for this to always hit, so it's allowed to be null.

export interface Chunk {
  section: string | null;
  content: string;
}

const TARGET_WORDS = 650; // ~500-800 token target, mid-range
const MAX_WORDS = 800;
const OVERLAP_WORDS = 90;

const HEADING_PATTERN =
  /^(ARTICLE\s+[IVXLCDM\d]+|SECTION\s+[\dA-Z.]+|[A-Z][A-Z0-9 ,.'&-]{6,})\s*[:.\-]?\s*$/;

function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 90) return false;
  return HEADING_PATTERN.test(trimmed);
}

/** Split raw extracted PDF text into paragraphs, dropping blank runs. */
function toParagraphs(rawText: string): string[] {
  return rawText
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

export function chunkDocument(rawText: string): Chunk[] {
  const paragraphs = toParagraphs(rawText);
  const chunks: Chunk[] = [];

  let currentWords: string[] = [];
  // How many of currentWords are genuinely new since the last flush, as
  // opposed to the overlap tail carried over from the previous chunk —
  // lets flush() skip pushing a chunk that's nothing but that leftover
  // overlap (e.g. a trailing flush() with no new paragraphs after it).
  let newWordCount = 0;
  let currentSection: string | null = null;
  let pendingSection: string | null = null;

  const flush = () => {
    if (newWordCount === 0) return;
    chunks.push({ section: currentSection, content: currentWords.join(" ") });
    // Carry the tail of this chunk forward as overlap for the next one.
    currentWords = currentWords.slice(-OVERLAP_WORDS);
    newWordCount = 0;
  };

  for (const paragraph of paragraphs) {
    if (looksLikeHeading(paragraph)) {
      pendingSection = paragraph;
      // A heading is a natural chunk boundary — start fresh under it
      // rather than letting it get buried mid-chunk.
      flush();
      currentSection = pendingSection;
      continue;
    }

    const words = paragraph.split(/\s+/);
    if (newWordCount > 0 && currentWords.length + words.length > MAX_WORDS) {
      flush();
      currentSection = pendingSection;
    }
    currentWords.push(...words);
    newWordCount += words.length;
    if (newWordCount >= TARGET_WORDS) {
      flush();
      currentSection = pendingSection;
    }
  }
  flush();

  return chunks.filter((c) => c.content.trim().length > 0);
}
