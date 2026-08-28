import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { AcademicsClient } from "./AcademicsClient";

// Chapter Standards Section B (Academics) credits with no other home:
// B1 (Member GPAs), B2 (Mentorship Program), B3 (Alpha Order), B5
// (Professional Development). B4/B6 (Study Hours) already have their
// own module — see Study Hours instead. Split out of the old, single
// "Official Standards Forms" data-entry page (see MODULES.md) so that
// page could become a pure checklist instead of duplicating every
// section's forms on one page.
export default async function AcademicsPage() {
  const { allowed } = await requirePageAccess("academics");
  if (!allowed) return <NotAuthorized moduleTitle="Academics" positions={["Vice President"]} />;

  const [members, gpaRecords, mentorships, alphaOrderRecords, professionalDevelopmentEvents] = await Promise.all([
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    prisma.gpaRecord.findMany({
      include: { member: true },
      orderBy: [{ term: "desc" }, { createdAt: "desc" }],
    }),
    prisma.mentorship.findMany({
      include: { mentee: true, mentor: true },
      orderBy: [{ term: "desc" }, { createdAt: "desc" }],
    }),
    prisma.alphaOrderRecord.findMany({
      include: { member: true },
      orderBy: [{ term: "desc" }, { createdAt: "desc" }],
    }),
    prisma.professionalDevelopmentEvent.findMany({
      include: { attendees: { include: { member: true } } },
      orderBy: [{ term: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Academics</h1>

      <div className="mt-6">
        <AcademicsClient
          members={members}
          initialGpaRecords={gpaRecords}
          initialMentorships={mentorships}
          initialAlphaOrderRecords={alphaOrderRecords}
          initialProfessionalDevelopmentEvents={professionalDevelopmentEvents}
        />
      </div>
    </div>
  );
}
