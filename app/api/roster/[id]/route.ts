import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMemberStatus } from "@/lib/roster";
import { requireApiAccess } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("roster");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // No `role` here — positions are assigned only from Manage Officers &
  // Logins (President-only, /api/officers/[id]/role), never through
  // this route, even by whoever owns Roster itself.
  const data: {
    name?: string;
    crossingTerm?: string | null;
    email?: string | null;
    status?: string;
    class?: string | null;
    crossingNumber?: number | null;
    nickname?: string | null;
    phone?: string | null;
  } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    data.name = name;
  }
  if (typeof body.crossingTerm === "string")
    data.crossingTerm = body.crossingTerm.trim() || null;
  if (typeof body.email === "string") data.email = body.email.trim() || null;
  if (typeof body.status === "string") {
    if (!isMemberStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    data.status = body.status;
  }
  if (typeof body.class === "string") data.class = body.class.trim() || null;
  if (typeof body.nickname === "string") data.nickname = body.nickname.trim() || null;
  if (typeof body.phone === "string") data.phone = body.phone.trim() || null;
  if ("crossingNumber" in body) {
    if (body.crossingNumber === null || body.crossingNumber === "") {
      data.crossingNumber = null;
    } else {
      const n = Number(body.crossingNumber);
      if (!Number.isFinite(n)) {
        return NextResponse.json(
          { error: "Crossing number must be a number." },
          { status: 400 }
        );
      }
      data.crossingNumber = n;
    }
  }

  try {
    const member = await prisma.member.update({ where: { id }, data });
    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireApiAccess("roster");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.member.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
}
