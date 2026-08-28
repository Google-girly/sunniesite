import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// A member's saved, reusable drawn signature — captured once from the
// signature pad on Event Reports, then auto-loaded from here onto every
// future report they sign so they don't have to redraw it each time.
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const signature = await prisma.memberSignature.findUnique({ where: { memberId: id } });
  return NextResponse.json(signature);
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const imageData = typeof body?.imageData === "string" ? body.imageData : "";
  if (!imageData.startsWith("data:image/")) {
    return NextResponse.json({ error: "A signature image is required." }, { status: 400 });
  }

  try {
    const signature = await prisma.memberSignature.upsert({
      where: { memberId: id },
      create: { memberId: id, imageData },
      update: { imageData },
    });
    return NextResponse.json(signature);
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    await prisma.memberSignature.delete({ where: { memberId: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No saved signature for this member." }, { status: 404 });
  }
}
