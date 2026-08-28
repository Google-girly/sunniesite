import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleOwnerApi } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await requireModuleOwnerApi("community-service");
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: {
    term?: string;
    hoursUncompleted?: number;
    project?: string | null;
    dueDate?: string | null;
    completed?: boolean;
    libraryHoursCompleted?: boolean;
  } = {};

  if (typeof body.term === "string") {
    const term = body.term.trim();
    if (!term) {
      return NextResponse.json({ error: "Term is required." }, { status: 400 });
    }
    data.term = term;
  }
  if (typeof body.hoursUncompleted === "number") {
    if (!Number.isFinite(body.hoursUncompleted) || body.hoursUncompleted <= 0) {
      return NextResponse.json(
        { error: "Hours uncompleted must be a number greater than zero." },
        { status: 400 }
      );
    }
    data.hoursUncompleted = body.hoursUncompleted;
  }
  if (typeof body.project === "string") data.project = body.project.trim() || null;
  if ("dueDate" in body) {
    if (typeof body.dueDate === "string" && body.dueDate.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate.trim())) {
        return NextResponse.json({ error: "Due date must be a valid date." }, { status: 400 });
      }
      data.dueDate = body.dueDate.trim();
    } else {
      data.dueDate = null;
    }
  }
  if (typeof body.completed === "boolean") data.completed = body.completed;
  if (typeof body.libraryHoursCompleted === "boolean")
    data.libraryHoursCompleted = body.libraryHoursCompleted;

  try {
    const makeup = await prisma.makeUpProject.update({ where: { id }, data });
    return NextResponse.json(makeup);
  } catch {
    return NextResponse.json({ error: "Make-up project not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await requireModuleOwnerApi("community-service");
  if ("error" in access) return access.error;

  const { id } = await params;
  try {
    await prisma.makeUpProject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Make-up project not found." }, { status: 404 });
  }
}
