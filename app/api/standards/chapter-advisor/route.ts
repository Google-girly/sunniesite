import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function GET() {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const advisors = await prisma.chapterAdvisor.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(advisors);
}

export async function POST(request: Request) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() || null : null;
  const email = typeof body.email === "string" ? body.email.trim() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const officeAddress = typeof body.officeAddress === "string" ? body.officeAddress.trim() || null : null;

  const advisor = await prisma.chapterAdvisor.create({
    data: { name, title, email, phone, officeAddress },
  });
  return NextResponse.json(advisor, { status: 201 });
}
