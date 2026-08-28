import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Manual self-attestation for checklist items with no backing data at
// all (see lib/chapterStandardsChecklist.ts, `kind: "manual"`).
export async function GET() {
  const overrides = await prisma.checklistOverride.findMany();
  return NextResponse.json(overrides);
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "code is required." }, { status: 400 });
  }
  const done = body.done === true;
  const note = typeof body.note === "string" ? body.note.trim() || null : null;

  const override = await prisma.checklistOverride.upsert({
    where: { code },
    create: { code, done, note },
    update: { done, note },
  });
  return NextResponse.json(override);
}
