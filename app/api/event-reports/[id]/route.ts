import { NextResponse } from "next/server";
import { parseEventReportInput } from "@/lib/eventReports";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { isPresident } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.eventReport.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Event report not found." }, { status: 404 });
  }
  // Only whoever originally filled this out, or the President, may edit
  // it — everyone else can still view/submit her own new ones (the
  // module itself stays open-submit). Reports from before this field
  // existed have no recorded creator, so they're President-only until
  // re-saved.
  if (existing.createdByMemberId !== member.id && !isPresident(member)) {
    return NextResponse.json(
      { error: "Only whoever submitted this report, or the President, can edit it." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = parseEventReportInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const report = await prisma.eventReport.update({
      where: { id },
      data: parsed.data,
      include: { signerMember: true },
    });
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "Event report not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    await prisma.eventReport.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Event report not found." }, { status: 404 });
  }
}
