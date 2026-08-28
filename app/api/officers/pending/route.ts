import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApproverApi } from "@/lib/session";

// Every self-signup (app/api/auth/signup) waiting on approval —
// President, Vice President, or VP of Communications only, see
// lib/permissions.ts canApproveSignups().
export async function GET() {
  const access = await requireApproverApi();
  if ("error" in access) return access.error;

  const pending = await prisma.member.findMany({
    where: { approved: false },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(pending);
}
