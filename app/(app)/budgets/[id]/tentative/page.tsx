import { notFound } from "next/navigation";
import { nextMeetingDate, todayIso } from "@/lib/meetings";
import { prisma } from "@/lib/prisma";
import { RECEIPT_SELECT } from "@/lib/receipts";
import { findRoleHolderNames } from "@/lib/roster";
import { VersionDetailClient } from "../VersionDetailClient";

export default async function TentativeBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget) notFound();

  const version = await prisma.budgetVersion.findUnique({
    where: { budgetId_stage: { budgetId: id, stage: "TENTATIVE" } },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      receipts: { select: RECEIPT_SELECT, orderBy: { uploadedAt: "asc" } },
    },
  });
  if (!version) notFound();

  // "Submitted By" suggestion — see final/page.tsx for the same thing.
  let chairHolderName: string | null = null;
  if (budget.chair) {
    const members = await prisma.member.findMany({ select: { name: true, role: true } });
    chairHolderName = findRoleHolderNames(members, budget.chair);
  }

  const schedules = await prisma.meetingSchedule.findMany({ where: { active: true } });
  const nextMeetingIso = nextMeetingDate(schedules, todayIso());

  return (
    <VersionDetailClient
      budget={budget}
      initialVersion={version}
      stage="TENTATIVE"
      chairHolderName={chairHolderName}
      nextMeetingIso={nextMeetingIso}
    />
  );
}
