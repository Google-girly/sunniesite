import { NextResponse } from "next/server";
import { isLeadershipCategory } from "@/lib/standardsForms";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function GET() {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const positions = await prisma.leadershipPosition.findMany({
    orderBy: [{ academicYear: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(positions);
}

export async function POST(request: Request) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const memberName = typeof body.memberName === "string" ? body.memberName.trim() : "";
  const organization = typeof body.organization === "string" ? body.organization.trim() : "";
  const position = typeof body.position === "string" ? body.position.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  if (!memberName || !organization || !position) {
    return NextResponse.json({ error: "Member, organization, and position are required." }, { status: 400 });
  }
  if (!isLeadershipCategory(category)) {
    return NextResponse.json({ error: "Select whether this is Greek Related or Non-Greek Related." }, { status: 400 });
  }
  const memberId = typeof body.memberId === "string" && body.memberId ? body.memberId : null;
  const academicYear = typeof body.academicYear === "string" ? body.academicYear.trim() || null : null;

  const record = await prisma.leadershipPosition.create({
    data: { memberId, memberName, organization, position, category, academicYear },
  });
  return NextResponse.json(record, { status: 201 });
}
