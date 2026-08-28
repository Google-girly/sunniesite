import { NextResponse } from "next/server";
import { buildStrategicPlanLetter, strategicPlanLetterFilename } from "@/lib/standardsFormsLetters";
import { isPlanPeriod } from "@/lib/standardsForms";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/session";

export async function GET(request: Request) {
  const access = await requireApiAccess("leadership");
  if ("error" in access) return access.error;

  const { searchParams } = new URL(request.url);
  const academicYear = searchParams.get("academicYear") ?? "";
  const variant = searchParams.get("variant") === "PROGRESS" ? "PROGRESS" : "PLAN";
  const periodParam = searchParams.get("period") ?? "";
  const period = isPlanPeriod(periodParam) ? periodParam : "YEAR";
  if (!academicYear) {
    return NextResponse.json({ error: "academicYear is required." }, { status: 400 });
  }
  const signoffKey = `${academicYear}:${period}:${variant}`;
  const [goals, signoff] = await Promise.all([
    prisma.strategicPlanGoal.findMany({ where: { academicYear, period }, orderBy: { createdAt: "asc" } }),
    prisma.letterSignoff.findUnique({ where: { section_key: { section: "strategic-plan", key: signoffKey } } }),
  ]);
  if (goals.length === 0) {
    return NextResponse.json({ error: "No strategic plan goals found for that academic year/period." }, { status: 404 });
  }

  const bytes = await buildStrategicPlanLetter(
    academicYear,
    goals,
    {
      signerName: signoff?.signerName ?? "",
      signerTitle: signoff?.signerTitle,
      signedDate: signoff?.signedDate,
      signatureImage: signoff?.signatureImage,
    },
    variant,
    period
  );
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${strategicPlanLetterFilename(academicYear, variant, period)}"`,
    },
  });
}
