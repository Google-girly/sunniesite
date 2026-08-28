import { NextResponse } from "next/server";
import {
  buildCommunityServiceReportWorkbook,
  communityServiceReportExportFilename,
} from "@/lib/communityServiceExport";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

// The compiled "Community Service Chapter Standard Forms" — Section C3/C4
// (every Active/Inactive member's hour log, several per sheet) and
// Section C6 (Community Service Make-Up, for whoever currently has a
// MakeUpProject on file) — see lib/communityServiceExport.ts.
export async function GET() {
  const access = await requireModuleOwnerApi("community-service");
  if ("error" in access) return access.error;

  const hoursMembers = await prisma.member.findMany({
    where: { status: { in: ["ACTIVE", "INACTIVE"] } },
    include: { serviceHours: true },
  });
  const makeUpMembers = await prisma.member.findMany({
    include: { makeUpProjects: true },
  });

  const bytes = await buildCommunityServiceReportWorkbook(hoursMembers, makeUpMembers);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${communityServiceReportExportFilename()}"`,
    },
  });
}
