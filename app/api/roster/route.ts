import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMemberStatus } from "@/lib/roster";
import { requireApiAccess } from "@/lib/session";

export async function GET() {
  const access = await requireApiAccess("roster");
  if ("error" in access) return access.error;

  const members = await prisma.member.findMany({
    orderBy: [{ crossingNumber: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });
  return NextResponse.json(members);
}

export async function POST(request: Request) {
  const access = await requireApiAccess("roster");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const status =
    typeof body?.status === "string" && isMemberStatus(body.status)
      ? body.status
      : "ACTIVE";
  // No `role` here — positions are assigned only from Manage Officers &
  // Logins (President-only, /api/officers), never through this route.
  const crossingTerm =
    typeof body?.crossingTerm === "string" && body.crossingTerm.trim()
      ? body.crossingTerm.trim()
      : null;
  const email =
    typeof body?.email === "string" && body.email.trim()
      ? body.email.trim()
      : null;
  const memberClass =
    typeof body?.class === "string" && body.class.trim() ? body.class.trim() : null;
  const nickname =
    typeof body?.nickname === "string" && body.nickname.trim()
      ? body.nickname.trim()
      : null;
  let crossingNumber: number | null = null;
  if (body?.crossingNumber !== undefined && body?.crossingNumber !== null && body?.crossingNumber !== "") {
    const n = Number(body.crossingNumber);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Crossing number must be a number." }, { status: 400 });
    }
    crossingNumber = n;
  }

  const member = await prisma.member.create({
    data: {
      name,
      status,
      crossingTerm,
      email,
      class: memberClass,
      crossingNumber,
      nickname,
    },
  });

  return NextResponse.json(member, { status: 201 });
}
