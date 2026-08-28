import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";
import { MeetingScheduleDetailClient } from "./MeetingScheduleDetailClient";

// A recurring series' own page (Aug 2026) — full edit (day/interval/
// anchor/time/label, beyond just the Active toggle the list page has),
// plus every real Meeting (minutes) record that's actually been logged
// against this series, via Meeting.scheduleId.
export default async function MeetingScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = await getCurrentMember();
  if (!member) redirect("/login");
  const canManage = ownsModule(member, "meetings-reports");

  const schedule = await prisma.meetingSchedule.findUnique({ where: { id } });
  if (!schedule) notFound();

  const meetings = await prisma.meeting.findMany({
    where: { scheduleId: id },
    orderBy: { date: "desc" },
  });

  return <MeetingScheduleDetailClient schedule={schedule} initialMeetings={meetings} canManage={canManage} />;
}
