import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEditPositionsApi } from "@/lib/session";
import { OFFICER_POSITIONS } from "@/lib/positions";
import { serializeRoles } from "@/lib/roster";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// The ONLY route that can change a member's position(s) — see
// lib/permissions.ts. President, VP, or VP of Communications (Aug 2026
// — was President-only). Roster's own PATCH deliberately never touches
// `role`, even for whoever owns Roster.
export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireEditPositionsApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const roles = Array.isArray(body?.role) ? body.role.filter((r: unknown) => typeof r === "string") : null;
  if (!roles) {
    return NextResponse.json({ error: "`role` must be an array of position names." }, { status: 400 });
  }
  const invalid = roles.filter((r: string) => !(OFFICER_POSITIONS as readonly string[]).includes(r));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Unknown position(s): ${invalid.join(", ")}` }, { status: 400 });
  }

  try {
    const member = await prisma.member.update({
      where: { id },
      data: { role: serializeRoles(roles) },
    });
    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
}
