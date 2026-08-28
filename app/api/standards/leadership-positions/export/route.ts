import { NextResponse } from "next/server";
import { isLeadershipCategory } from "@/lib/standardsForms";
import { buildLeadershipPositionsLetter, leadershipPositionsLetterFilename } from "@/lib/standardsFormsLetters";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function GET(request: Request) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const { searchParams } = new URL(request.url);
  const academicYear = searchParams.get("academicYear") ?? "";
  const category = searchParams.get("category") ?? "";
  if (!academicYear || !isLeadershipCategory(category)) {
    return NextResponse.json({ error: "academicYear and a valid category are required." }, { status: 400 });
  }
  const positions = await prisma.leadershipPosition.findMany({
    where: { academicYear, category },
    orderBy: { createdAt: "asc" },
  });
  if (positions.length === 0) {
    return NextResponse.json({ error: "No leadership positions found for that academic year/category." }, { status: 404 });
  }

  const bytes = await buildLeadershipPositionsLetter(academicYear, positions, category);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${leadershipPositionsLetterFilename(academicYear, category)}"`,
    },
  });
}
