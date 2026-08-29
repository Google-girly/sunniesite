import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { parseChecklistDocumentInput } from "@/lib/checklistDocuments";

// Same access as everything else on Official Standards Forms — "open"
// (see lib/permissions.ts MODULE_ACCESS), no extra gate here, matching
// app/api/standards/checklist-override's own pattern. getCurrentMember
// is just for attribution (uploadedByName), not a restriction.
export async function GET() {
  const documents = await prisma.checklistDocument.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, label: true, fileName: true, mimeType: true, uploadedByName: true, createdAt: true },
  });
  return NextResponse.json(documents);
}

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseChecklistDocumentInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const document = await prisma.checklistDocument.create({
    data: { ...parsed.data, uploadedByMemberId: member.id, uploadedByName: member.name },
    select: { id: true, code: true, label: true, fileName: true, mimeType: true, uploadedByName: true, createdAt: true },
  });
  return NextResponse.json(document, { status: 201 });
}
