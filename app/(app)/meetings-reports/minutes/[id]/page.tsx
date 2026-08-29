import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { isOfficer, ownsModule } from "@/lib/permissions";
import { parseRoles } from "@/lib/roster";
import { NotAuthorized } from "@/components/NotAuthorized";
import { MeetingMinutesClient } from "./MeetingMinutesClient";

// Officers only (Aug 2026 — "I only want this page to be accessable to
// officers"). Everyone else still downloads the finished minutes from
// the list page (app/(app)/meetings-reports/minutes/page.tsx) or the
// export routes, which stay open to any logged-in member — this page
// is specifically the editing surface.
export default async function MeetingMinutesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await getCurrentMember();
  if (!viewer) redirect("/login");
  if (!isOfficer(viewer)) {
    return <NotAuthorized moduleTitle="Meeting Minutes" positions={["Officers"]} />;
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { officerReports: true, notes: { include: { author: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!meeting) notFound();

  const members = await prisma.member.findMany({
    select: { name: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <MeetingMinutesClient
      meeting={meeting}
      members={members}
      viewerId={viewer.id}
      viewerPositions={parseRoles(viewer.role)}
      viewerOwnsModule={ownsModule(viewer, "meetings-reports")}
    />
  );
}
