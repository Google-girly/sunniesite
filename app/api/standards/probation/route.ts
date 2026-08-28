import { NextResponse } from "next/server";
import { isProbationStatus } from "@/lib/standardsForms";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function POST(request: Request) {
  const access = await requireApiAccess("sisterhood");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) {
    return NextResponse.json({ error: "Member is required." }, { status: 400 });
  }
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!isProbationStatus(status)) {
    return NextResponse.json({ error: "Status must be Probation or Suspension." }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const record = await prisma.probationRecord.create({
    data: {
      memberId,
      status,
      dateInEffectStart: str(body.dateInEffectStart),
      dateInEffectEnd: str(body.dateInEffectEnd),
      offense: str(body.offense),
      additionalSanctions: str(body.additionalSanctions),
    },
  });

  return NextResponse.json(record, { status: 201 });
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
