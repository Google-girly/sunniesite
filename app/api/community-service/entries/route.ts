import { NextResponse } from "next/server";
import { isServiceCategory } from "@/lib/communityService";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { canManageRecord } from "@/lib/permissions";

export async function POST(request: Request) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) {
    return NextResponse.json({ error: "Member is required." }, { status: 400 });
  }
  if (!canManageRecord(viewer, "community-service", memberId)) {
    return NextResponse.json({ error: "You can only log your own community service." }, { status: 403 });
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event.trim() : "";
  if (!event) {
    return NextResponse.json({ error: "Event is required." }, { status: 400 });
  }

  const hours = typeof body.hours === "number" ? body.hours : NaN;
  if (!Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json(
      { error: "Hours must be a number greater than zero." },
      { status: 400 }
    );
  }

  if (typeof body.category !== "string" || !isServiceCategory(body.category)) {
    return NextResponse.json({ error: "Category is required." }, { status: 400 });
  }
  const category = body.category;

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 });
  }

  const volunteerContact =
    typeof body.volunteerContact === "string" ? body.volunteerContact.trim() : "";
  if (!volunteerContact) {
    return NextResponse.json({ error: "Volunteer Contact is required." }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const entry = await prisma.serviceHourEntry.create({
    data: { memberId, date, event, hours, category, description, volunteerContact },
  });

  return NextResponse.json(entry, { status: 201 });
}
