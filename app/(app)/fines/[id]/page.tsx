import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MemberAccountClient } from "./MemberAccountClient";

export default async function MemberAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: { accountEntries: { orderBy: { date: "desc" } } },
  });
  if (!member) notFound();

  return <MemberAccountClient member={member} />;
}
