import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string; versionId: string; receiptId: string }>;
}

// Serves the actual file bytes — "inline" (not "attachment") so a
// browser tab can preview an image/PDF straight away instead of forcing
// a download for something you're just trying to double-check.
export async function GET(_request: Request, { params }: RouteParams) {
  const { receiptId } = await params;
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  const bytes = new Uint8Array(receipt.data.length);
  bytes.set(receipt.data);

  return new NextResponse(new Blob([bytes]), {
    headers: {
      "Content-Type": receipt.mimeType,
      "Content-Disposition": `inline; filename="${receipt.filename.replace(/"/g, "")}"`,
    },
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { receiptId } = await params;
  try {
    await prisma.receipt.delete({ where: { id: receiptId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }
}
