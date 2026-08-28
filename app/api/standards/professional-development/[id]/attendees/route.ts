import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("academics");
  if ("error" in access) return access.error;

  const { id: eventId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) {
    return NextResponse.json({ error: "Member is required." }, { status: 400 });
  }

  const [event, member] = await Promise.all([
    prisma.professionalDevelopmentEvent.findUnique({ where: { id: eventId } }),
    prisma.member.findUnique({ where: { id: memberId } }),
  ]);
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  try {
    const attendee = await prisma.professionalDevelopmentAttendee.create({
      data: { eventId, memberId },
      include: { member: true },
    });
    return NextResponse.json(attendee, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That member is already marked as attending." }, { status: 409 });
  }
}
