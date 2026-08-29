import { NextResponse } from "next/server";
import { buildStandardsFormsWorkbook, standardsFormsExportFilename } from "@/lib/standardsFormsExport";
import { currentTermLabel } from "@/lib/studyHours";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";

// Builds the compiled "Official Standards Forms" packet — Sections B1,
// B2, B3, B5, D4, D9, D10, D11. Sections C3/C4 and C6 export from
// Community Service; B4 and B6 export from Study Hours (see
// lib/communityServiceExport.ts, lib/studyHoursExport.ts). `term` and
// `year` are optional query params so a specific submission period can
// be requested instead of always defaulting to "now".
export async function GET(request: Request) {
  const viewer = await getCurrentMember();
  if (!viewer) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  // Aug 2026 — "I only want cultura and sisterhood to be able to see who
  // won sister of the month." This export is otherwise open (Official
  // Standards Forms is an "open" module — see lib/permissions.ts), so
  // Section D10's real winner names get scrubbed for anyone who isn't
  // the Commissioner of Cultura and Sisterhood (or President) — "N/A"
  // months still show as N/A, everything else in the export is
  // untouched.
  const canSeeWinners = ownsModule(viewer, "sisterhood");

  const url = new URL(request.url);
  const term = url.searchParams.get("term")?.trim() || currentTermLabel();
  const yearParam = Number(url.searchParams.get("year"));
  const year = Number.isFinite(yearParam) && yearParam > 0 ? yearParam : new Date().getFullYear();

  const [
    gpaRecords,
    mentorships,
    alphaOrderRecords,
    professionalDevelopmentEvents,
    probationRecords,
    meetingAttendanceRecords,
    sisterOfTheMonths,
    certificationRecords,
  ] = await Promise.all([
    prisma.gpaRecord.findMany({ where: { term }, include: { member: true } }),
    prisma.mentorship.findMany({ where: { term }, include: { mentee: true, mentor: true } }),
    prisma.alphaOrderRecord.findMany({ where: { term }, include: { member: true } }),
    prisma.professionalDevelopmentEvent.findMany({
      where: { term },
      include: { attendees: { include: { member: true } } },
    }),
    prisma.probationRecord.findMany({ include: { member: true } }),
    prisma.meetingAttendanceRecord.findMany({ where: { term } }),
    prisma.sisterOfTheMonth.findMany({ where: { year }, include: { member: true } }),
    prisma.certificationRecord.findMany({ include: { member: true } }),
  ]);

  const bytes = await buildStandardsFormsWorkbook({
    term,
    year,
    gpaRecords,
    mentorships,
    alphaOrderRecords,
    professionalDevelopmentEvents,
    probationRecords,
    meetingAttendanceRecords,
    sisterOfTheMonths: canSeeWinners
      ? sisterOfTheMonths
      : sisterOfTheMonths.map((r) => ({ ...r, member: null, memberId: null })),
    certificationRecords,
  });
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${standardsFormsExportFilename()}"`,
    },
  });
}
