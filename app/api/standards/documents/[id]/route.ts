import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Streams the actual file back out — the list route
// (app/api/standards/documents) deliberately omits fileData to stay
// lightweight, so downloading is its own request.
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const doc = await prisma.checklistDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const base64 = doc.fileData.split(",").pop() ?? "";
  const bytes = Buffer.from(base64, "base64");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${doc.fileName.replace(/"/g, "")}"`,
    },
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    await prisma.checklistDocument.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
}
