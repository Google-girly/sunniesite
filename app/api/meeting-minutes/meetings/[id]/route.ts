import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireModuleOwnerApi("meetings-reports");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: { date?: string; time?: string | null } = {};
  if (typeof body.date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date.trim())) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    data.date = body.date.trim();
  }
  if (typeof body.time === "string") data.time = body.time.trim() || null;

  try {
    const meeting = await prisma.meeting.update({ where: { id }, data });
    return NextResponse.json(meeting);
  } catch {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }
}

// Destructive (cascades every Officer Report attached to it) — same
// Secretary/Historian/President gate as PATCH above.
export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireModuleOwnerApi("meetings-reports");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.meeting.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }
}
