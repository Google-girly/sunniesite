import { notFound } from "next/navigation";
import { nextMeetingDate, todayIso } from "@/lib/meetings";
import { prisma } from "@/lib/prisma";
import { RECEIPT_SELECT } from "@/lib/receipts";
import { findRoleHolderNames } from "@/lib/roster";
import { VersionDetailClient } from "../VersionDetailClient";

export default async function FinalBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget) notFound();

  const version = await prisma.budgetVersion.findUnique({
    where: { budgetId_stage: { budgetId: id, stage: "FINAL" } },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      receipts: { select: RECEIPT_SELECT, orderBy: { uploadedAt: "asc" } },
    },
  });
  if (!version) notFound();

  // For "Import Items from Tentative Budget" — a Final Budget is often
  // drafted from what the Tentative one already estimated, so offer the
  // Tentative's line items as a checklist to pull from instead of
  // retyping everything. Only fetched here, not on the Tentative page —
  // this only goes one direction.
  const tentativeVersion = await prisma.budgetVersion.findUnique({
    where: { budgetId_stage: { budgetId: id, stage: "TENTATIVE" } },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      receipts: { select: RECEIPT_SELECT, orderBy: { uploadedAt: "asc" } },
    },
  });

  // "Submitted By" suggestion — whoever currently holds the position
  // picked as this event's Chair, per the Roster. Just a default the
  // Treasurer form pre-fills; still a free-text field, still editable.
  let chairHolderName: string | null = null;
  if (budget.chair) {
    const members = await prisma.member.findMany({ select: { name: true, role: true } });
    chairHolderName = findRoleHolderNames(members, budget.chair);
  }

  // "Date Due"/"Date Presented" suggestion — the next scheduled meeting.
  const schedules = await prisma.meetingSchedule.findMany({ where: { active: true } });
  const nextMeetingIso = nextMeetingDate(schedules, todayIso());

  return (
    <VersionDetailClient
      budget={budget}
      initialVersion={version}
      stage="FINAL"
      importSource={tentativeVersion}
      chairHolderName={chairHolderName}
      nextMeetingIso={nextMeetingIso}
    />
  );
}
