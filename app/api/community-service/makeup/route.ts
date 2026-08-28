import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

export async function POST(request: Request) {
  const access = await requireModuleOwnerApi("community-service");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) {
    return NextResponse.json({ error: "Member is required." }, { status: 400 });
  }

  const term = typeof body.term === "string" ? body.term.trim() : "";
  if (!term) {
    return NextResponse.json({ error: "Term is required." }, { status: 400 });
  }

  const hoursUncompleted = typeof body.hoursUncompleted === "number" ? body.hoursUncompleted : NaN;
  if (!Number.isFinite(hoursUncompleted) || hoursUncompleted <= 0) {
    return NextResponse.json(
      { error: "Hours uncompleted must be a number greater than zero." },
      { status: 400 }
    );
  }

  const project =
    typeof body.project === "string" && body.project.trim() ? body.project.trim() : null;
  let dueDate: string | null = null;
  if (typeof body.dueDate === "string" && body.dueDate.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate.trim())) {
      return NextResponse.json({ error: "Due date must be a valid date." }, { status: 400 });
    }
    dueDate = body.dueDate.trim();
  }
  const completed = body.completed === true;
  const libraryHoursCompleted = body.libraryHoursCompleted === true;

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const makeup = await prisma.makeUpProject.create({
    data: {
      memberId,
      term,
      hoursUncompleted,
      project,
      dueDate,
      completed,
      libraryHoursCompleted,
    },
  });

  return NextResponse.json(makeup, { status: 201 });
}
