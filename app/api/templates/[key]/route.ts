import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { TEMPLATE_LIBRARY } from "@/lib/templateLibrary";

interface RouteParams {
  params: Promise<{ key: string }>;
}

// Serves a raw, blank template straight out of lib/templates/ — no data
// filled in, unlike every other module's own "Export" button. This is
// the Template Library on Official Standards Forms; proxy.ts already
// requires a logged-in session for every route under /api except
// /api/auth, so this doesn't need its own auth check.
export async function GET(_request: Request, { params }: RouteParams) {
  const { key } = await params;
  const entry = TEMPLATE_LIBRARY.find((t) => t.key === key);
  if (!entry) {
    return NextResponse.json({ error: "Unknown template." }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "lib/templates", entry.file);
  const buffer = await fs.readFile(filePath);
  const file = new Uint8Array(buffer.length);
  file.set(buffer);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": entry.contentType,
      "Content-Disposition": `attachment; filename="${entry.downloadName}"`,
    },
  });
}
