import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MeetingMinutesClient } from "./MeetingMinutesClient";

export default async function MeetingMinutesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { officerReports: true },
  });
  if (!meeting) notFound();

  const members = await prisma.member.findMany({
    select: { name: true, role: true },
    orderBy: { name: "asc" },
  });

  return <MeetingMinutesClient meeting={meeting} members={members} />;
}
