import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function POST(request: Request) {
  const access = await requireApiAccess("academics");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const term = typeof body.term === "string" ? body.term.trim() : "";
  if (!term) {
    return NextResponse.json({ error: "Term is required." }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Event/Presentation title is required." }, { status: 400 });
  }

  const event = await prisma.professionalDevelopmentEvent.create({
    data: {
      term,
      title,
      presentedBy: str(body.presentedBy),
      date: str(body.date),
      time: str(body.time),
      location: str(body.location),
    },
    include: { attendees: { include: { member: true } } },
  });

  return NextResponse.json(event, { status: 201 });
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
