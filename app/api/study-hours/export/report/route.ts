import { NextResponse } from "next/server";
import {
  buildStudyHoursReportWorkbook,
  studyHoursReportExportFilename,
} from "@/lib/studyHoursExport";
import { currentTermLabel, currentTermRange } from "@/lib/studyHours";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

// Chapter Standards Section B4 (Active Member Study Hour Completion) and
// Section B6 (Inactive), computed from each member's weekly logged
// hours. `term`/`start`/`end` are optional query params — defaults to
// the app's current-term guess (see lib/studyHours.ts), overridable
// since the real submission needs an exact term boundary. Everyone's
// data, so restricted like the other Study Hours export.
export async function GET(request: Request) {
  const access = await requireModuleOwnerApi("study-hours");
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const defaultRange = currentTermRange();
  const term = url.searchParams.get("term")?.trim() || currentTermLabel();
  const start = url.searchParams.get("start")?.trim() || defaultRange.start;
  const end = url.searchParams.get("end")?.trim() || defaultRange.end;

  const [activeMembers, inactiveMembers] = await Promise.all([
    prisma.member.findMany({ where: { status: "ACTIVE" }, include: { studyHours: true } }),
    prisma.member.findMany({ where: { status: "INACTIVE" }, include: { studyHours: true } }),
  ]);

  const bytes = await buildStudyHoursReportWorkbook(activeMembers, inactiveMembers, term, start, end);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${studyHoursReportExportFilename()}"`,
    },
  });
}
