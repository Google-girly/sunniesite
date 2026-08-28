import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAllowedReceiptType, MAX_RECEIPT_SIZE } from "@/lib/receipts";

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

// multipart/form-data, not JSON — this is a real file upload. The
// listing itself isn't a separate GET here; receipts come back (without
// their bytes) as part of the version's own GET, same as line items do.
export async function POST(request: Request, { params }: RouteParams) {
  const { versionId } = await params;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (!isAllowedReceiptType(file.type)) {
    return NextResponse.json(
      { error: "Only images (JPEG/PNG/HEIC/WEBP) and PDFs are allowed." },
      { status: 400 }
    );
  }
  if (file.size > MAX_RECEIPT_SIZE) {
    return NextResponse.json(
      { error: `File is too large — 8MB max, this one is ${(file.size / (1024 * 1024)).toFixed(1)}MB.` },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const receipt = await prisma.receipt.create({
      data: {
        versionId,
        filename: file.name || "receipt",
        mimeType: file.type,
        size: file.size,
        data: bytes,
      },
      select: { id: true, filename: true, mimeType: true, size: true, uploadedAt: true },
    });
    return NextResponse.json(receipt, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Budget version not found." }, { status: 404 });
  }
}
