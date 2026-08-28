import { NextResponse } from "next/server";
import { parseEventReportInput } from "@/lib/eventReports";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";

export async function GET() {
  const reports = await prisma.eventReport.findMany({
    include: { signerMember: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(reports);
}

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseEventReportInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const report = await prisma.eventReport.create({
      // Whoever is logged in and submitting the form owns it for
      // editing purposes — see EventReport.createdByMemberId in the
      // schema. Not user-suppliable; parsed.data never sets this.
      data: { ...parsed.data, createdByMemberId: member.id },
      include: { signerMember: true },
    });
    return NextResponse.json(report, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save the event report." }, { status: 400 });
  }
}
