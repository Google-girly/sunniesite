import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { MemberAccountClient } from "./MemberAccountClient";

export default async function MemberAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Same Treasurer/President lock as the /fines list — without this, any
  // logged-in member could open another member's account by URL.
  const { allowed } = await requirePageAccess("fines");
  if (!allowed) return <NotAuthorized moduleTitle="Fines & Member Accounts" positions={["Treasurer"]} />;

  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: { accountEntries: { orderBy: { date: "desc" } } },
  });
  if (!member) notFound();

  return <MemberAccountClient member={member} />;
}
