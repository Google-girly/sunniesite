import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { SisterhoodClient } from "./SisterhoodClient";

// Chapter Standards Section D (Sisterhood) credits with no other home:
// D4 (Probation & Suspension), D9 (General Meeting Attendance), D10
// (Sister of the Month), D11 (CPR & First Aid Certification). D1/D2 are
// verified directly by National (nothing to submit); D3/D5-D9(social)
// export from Event Reports instead. Split out of the old, single
// "Official Standards Forms" data-entry page — see MODULES.md.
export default async function SisterhoodPage() {
  const { allowed } = await requirePageAccess("sisterhood");
  if (!allowed) {
    return <NotAuthorized moduleTitle="Sisterhood" positions={["Commissioner of Cultura and Sisterhood"]} />;
  }

  const [members, probationRecords, meetingAttendanceRecords, sisterOfTheMonths, certificationRecords] =
    await Promise.all([
      prisma.member.findMany({ orderBy: { name: "asc" } }),
      prisma.probationRecord.findMany({
        include: { member: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.meetingAttendanceRecord.findMany({
        orderBy: [{ term: "desc" }, { meetingNumber: "asc" }],
      }),
      prisma.sisterOfTheMonth.findMany({
        include: { member: true },
        orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      }),
      prisma.certificationRecord.findMany({
        include: { member: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Sisterhood</h1>

      <div className="mt-6">
        <SisterhoodClient
          members={members}
          initialProbationRecords={probationRecords}
          initialMeetingAttendanceRecords={meetingAttendanceRecords}
          initialSisterOfTheMonths={sisterOfTheMonths}
          initialCertificationRecords={certificationRecords}
        />
      </div>
    </div>
  );
}
