import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.chapterAdvisor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Advisor record not found." }, { status: 404 });
  }
}
