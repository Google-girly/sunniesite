import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { canManageRecord } from "@/lib/permissions";
import { NotAuthorized } from "@/components/NotAuthorized";
import { MemberServiceClient } from "./MemberServiceClient";

export default async function MemberServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await getCurrentMember();
  if (!viewer) redirect("/login");
  if (!canManageRecord(viewer, "community-service", id)) {
    return (
      <NotAuthorized
        moduleTitle="this member's Community Service log"
        positions={["Commissioner of Community Service"]}
      />
    );
  }

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      serviceHours: { orderBy: { date: "desc" } },
      makeUpProjects: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!member) notFound();

  return <MemberServiceClient member={member} />;
}
