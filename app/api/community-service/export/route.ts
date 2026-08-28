import { NextResponse } from "next/server";
import {
  buildCommunityServiceWorkbook,
  communityServiceExportFilename,
} from "@/lib/communityServiceExport";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

// One sheet per roster member whose status is exactly "Active" or
// "Inactive" (see lib/roster.ts MEMBER_STATUSES), cloned from the real
// "Community Service Hours" template — see lib/communityServiceExport.ts.
// Active Special Circumstance and Active Alumnae are deliberately left
// out, matching the literal "active or inactive" scope this module was
// asked to cover — worth revisiting if Special Circumstance members
// should be included too.
export async function GET() {
  const access = await requireModuleOwnerApi("community-service");
  if ("error" in access) return access.error;

  const members = await prisma.member.findMany({
    where: { status: { in: ["ACTIVE", "INACTIVE"] } },
    include: { serviceHours: true },
  });

  const bytes = await buildCommunityServiceWorkbook(members);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${communityServiceExportFilename()}"`,
    },
  });
}
