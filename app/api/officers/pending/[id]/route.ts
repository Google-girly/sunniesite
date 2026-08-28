import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApproverApi } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Approve a pending self-signup — she can log in immediately after.
export async function POST(_request: Request, { params }: RouteParams) {
  const access = await requireApproverApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    const member = await prisma.member.update({ where: { id }, data: { approved: true } });
    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: "Pending sign-up not found." }, { status: 404 });
  }
}

// Deny a pending self-signup — deletes the Member row outright rather
// than leaving a rejected-but-present record around. Guarded to only
// ever touch an unapproved row: this route existing can't be used to
// delete a real, already-approved member (that's Roster's job, with its
// own confirmation).
export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireApproverApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member || member.approved) {
    return NextResponse.json({ error: "Pending sign-up not found." }, { status: 404 });
  }
  await prisma.member.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
