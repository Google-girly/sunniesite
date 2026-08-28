"use client";

// Real, server-generated PDFs aren't in reach here (no LibreOffice/Word
// to drive a docx→pdf conversion, no headless-Chromium tooling in this
// project) — window.print() with the @media print rules on this page is
// the honest substitute. Every modern browser's print dialog offers
// "Save as PDF" as a destination, so this genuinely produces a PDF file,
// it's just the browser doing the rendering rather than the server.
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700"
    >
      Print / Save as PDF
    </button>
  );
}
