import { NextResponse } from "next/server";
import { isProbationStatus } from "@/lib/standardsForms";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("sisterhood");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    if (!isProbationStatus(body.status)) {
      return NextResponse.json({ error: "Status must be Probation or Suspension." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (typeof body.dateInEffectStart === "string") data.dateInEffectStart = body.dateInEffectStart.trim() || null;
  if (typeof body.dateInEffectEnd === "string") data.dateInEffectEnd = body.dateInEffectEnd.trim() || null;
  if (typeof body.offense === "string") data.offense = body.offense.trim() || null;
  if (typeof body.additionalSanctions === "string")
    data.additionalSanctions = body.additionalSanctions.trim() || null;

  try {
    const record = await prisma.probationRecord.update({ where: { id }, data });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("sisterhood");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.probationRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }
}
