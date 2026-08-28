import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";
import { parseRoles } from "@/lib/roster";
import { MeetingMinutesClient } from "./MeetingMinutesClient";

export default async function MeetingMinutesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await getCurrentMember();
  if (!viewer) redirect("/login");

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
