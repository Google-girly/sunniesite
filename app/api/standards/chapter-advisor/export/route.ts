import { NextResponse } from "next/server";
import { buildChapterAdvisorLetter, chapterAdvisorLetterFilename } from "@/lib/standardsFormsLetters";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function GET() {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const advisors = await prisma.chapterAdvisor.findMany({ orderBy: { createdAt: "desc" } });
  const bytes = await buildChapterAdvisorLetter(advisors);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${chapterAdvisorLetterFilename()}"`,
    },
  });
}
