import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

// Shared signoff record backing every letter-style export that needs a
// signature (F.4, F.5 ×2 variants, G.4, G.6 — see
// lib/standardsFormsLetters.ts). `section`+`key` identify which letter a
// signature belongs to (a term, an academic year, or "singleton" where
// there's no natural grouping); re-saving upserts on that pair rather
// than accumulating duplicate signoffs.
export async function GET(request: Request) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") ?? "";
  const key = searchParams.get("key") ?? "";
  if (!section || !key) {
    return NextResponse.json({ error: "section and key are required." }, { status: 400 });
  }
  const signoff = await prisma.letterSignoff.findUnique({ where: { section_key: { section, key } } });
  return NextResponse.json(signoff);
}

export async function PUT(request: Request) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const section = typeof body.section === "string" ? body.section.trim() : "";
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
  if (!section || !key || !signerName) {
    return NextResponse.json({ error: "section, key, and signerName are required." }, { status: 400 });
  }
  const signerTitle = typeof body.signerTitle === "string" ? body.signerTitle.trim() || null : null;
  const signerMemberId = typeof body.signerMemberId === "string" && body.signerMemberId ? body.signerMemberId : null;
  const signedDate = typeof body.signedDate === "string" && body.signedDate ? body.signedDate : null;
  const signatureImage =
    typeof body.signatureImage === "string" && body.signatureImage.startsWith("data:image/")
      ? body.signatureImage
      : null;

  try {
    const signoff = await prisma.letterSignoff.upsert({
      where: { section_key: { section, key } },
      create: { section, key, signerName, signerTitle, signerMemberId, signedDate, signatureImage },
      update: { signerName, signerTitle, signerMemberId, signedDate, signatureImage },
    });
    return NextResponse.json(signoff);
  } catch {
    return NextResponse.json({ error: "Could not save the signoff." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") ?? "";
  const key = searchParams.get("key") ?? "";
  if (!section || !key) {
    return NextResponse.json({ error: "section and key are required." }, { status: 400 });
  }
  try {
    await prisma.letterSignoff.delete({ where: { section_key: { section, key } } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No signoff found for that section/key." }, { status: 404 });
  }
}
