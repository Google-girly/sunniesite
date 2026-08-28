import { NextResponse } from "next/server";
import { buildStudyHoursWorkbook, studyHoursExportFilename } from "@/lib/studyHoursExport";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

// One sheet per Active/Inactive roster member, cloned from the real
// "Library Study Hours" template — see lib/studyHoursExport.ts. Same
// Active/Inactive-only scope as Community Service's hour-log export.
// Dumps every member's log, so it's restricted to whoever manages
// Study Hours (Vice President/President), not self-service like the
// entries themselves.
export async function GET() {
  const access = await requireModuleOwnerApi("study-hours");
  if ("error" in access) return access.error;

  const members = await prisma.member.findMany({
    where: { status: { in: ["ACTIVE", "INACTIVE"] } },
    include: { studyHours: true },
  });

  const bytes = await buildStudyHoursWorkbook(members);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${studyHoursExportFilename()}"`,
    },
  });
}
