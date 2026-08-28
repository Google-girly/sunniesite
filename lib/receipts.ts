// Shared receipt-upload constants — used by both the API route (real
// enforcement) and the UI (so a bad file gets rejected before it's even
// sent). Kept small and permissive: this only needs to cover what a
// phone camera or a "save as PDF" from an email produces.

export const MAX_RECEIPT_SIZE = 8 * 1024 * 1024; // 8MB — plenty for a photo, small enough dev.db doesn't balloon

export const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "application/pdf",
] as const;

export function isAllowedReceiptType(mimeType: string): boolean {
  return (ALLOWED_RECEIPT_TYPES as readonly string[]).includes(mimeType);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Everywhere a BudgetVersion is loaded with its receipts (both API
// routes and the server pages), use this — never `data`, the actual
// file bytes. Those are only ever fetched one at a time, on demand, via
// GET .../receipts/[receiptId] when someone opens a specific receipt.
export const RECEIPT_SELECT = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  uploadedAt: true,
} as const;
