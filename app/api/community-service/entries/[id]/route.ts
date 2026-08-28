import { NextResponse } from "next/server";
import { isServiceCategory } from "@/lib/communityService";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { canManageRecord } from "@/lib/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.serviceHourEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  if (!canManageRecord(viewer, "community-service", existing.memberId)) {
    return NextResponse.json({ error: "You can only edit your own community service." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: {
    date?: string;
    event?: string;
    hours?: number;
    category?: string;
    description?: string;
    volunteerContact?: string;
  } = {};

  if (typeof body.date === "string") {
    const date = body.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    data.date = date;
  }
  if (typeof body.event === "string") {
    const event = body.event.trim();
    if (!event) {
      return NextResponse.json({ error: "Event is required." }, { status: 400 });
    }
    data.event = event;
  }
  if (typeof body.hours === "number") {
    if (!Number.isFinite(body.hours) || body.hours <= 0) {
      return NextResponse.json(
        { error: "Hours must be a number greater than zero." },
        { status: 400 }
      );
    }
    data.hours = body.hours;
  }
  if (typeof body.category === "string") {
    if (!isServiceCategory(body.category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    data.category = body.category;
  }
  if (typeof body.description === "string") {
    const description = body.description.trim();
    if (!description) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }
    data.description = description;
  }
  if (typeof body.volunteerContact === "string") {
    const volunteerContact = body.volunteerContact.trim();
    if (!volunteerContact) {
      return NextResponse.json({ error: "Volunteer Contact is required." }, { status: 400 });
    }
    data.volunteerContact = volunteerContact;
  }

  try {
    const entry = await prisma.serviceHourEntry.update({ where: { id }, data });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.serviceHourEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  if (!canManageRecord(viewer, "community-service", existing.memberId)) {
    return NextResponse.json({ error: "You can only remove your own community service." }, { status: 403 });
  }

  await prisma.serviceHourEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
