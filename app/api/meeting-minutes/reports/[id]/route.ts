import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";
import { parseRoles } from "@/lib/roster";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.officerReport.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  if (!ownsModule(viewer, "meetings-reports") && !parseRoles(viewer.role).includes(existing.position)) {
    return NextResponse.json({ error: "You can only remove your own report." }, { status: 403 });
  }

  await prisma.officerReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
