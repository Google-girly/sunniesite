import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("academics");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.term === "string") {
    if (!body.term.trim()) {
      return NextResponse.json({ error: "Term is required." }, { status: 400 });
    }
    data.term = body.term.trim();
  }
  if (typeof body.status === "string") data.status = body.status.trim() || null;
  if (typeof body.major === "string") data.major = body.major.trim() || null;
  if (body.termGpa === null || typeof body.termGpa === "number") data.termGpa = body.termGpa;
  if (body.cumGpa === null || typeof body.cumGpa === "number") data.cumGpa = body.cumGpa;

  try {
    const record = await prisma.gpaRecord.update({ where: { id }, data });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("academics");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.gpaRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }
}
