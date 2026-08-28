import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { canManageRecord } from "@/lib/permissions";
import { NotAuthorized } from "@/components/NotAuthorized";
import { MemberStudyHoursClient } from "./MemberStudyHoursClient";

export default async function MemberStudyHoursPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await getCurrentMember();
  if (!viewer) redirect("/login");
  if (!canManageRecord(viewer, "study-hours", id)) {
    return <NotAuthorized moduleTitle="this member's Study Hours log" positions={["Vice President"]} />;
  }

  const member = await prisma.member.findUnique({
    where: { id },
    include: { studyHours: { orderBy: { date: "desc" } } },
  });
  if (!member) notFound();

  return <MemberStudyHoursClient member={member} />;
}
