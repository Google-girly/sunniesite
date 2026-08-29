import { NextResponse } from "next/server";
import { buildLetterDocx, letterFilename } from "@/lib/letterExport";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const { id } = await params;
  const letter = await prisma.letter.findUnique({ where: { id } });
  if (!letter) {
    return NextResponse.json({ error: "Letter not found." }, { status: 404 });
  }
  if (letter.createdByMemberId !== member.id && !ownsModule(member, "letters")) {
    return NextResponse.json({ error: "Only who created this (or the President) can download it." }, { status: 403 });
  }

  const bytes = await buildLetterDocx(letter);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${letterFilename(letter)}"`,
    },
  });
}
