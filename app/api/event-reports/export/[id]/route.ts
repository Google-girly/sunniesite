import { NextResponse } from "next/server";
import { buildEventReportDocx, eventReportExportFilename } from "@/lib/eventReportExport";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const report = await prisma.eventReport.findUnique({ where: { id } });
  if (!report) {
    return NextResponse.json({ error: "Event report not found." }, { status: 404 });
  }

  const bytes = await buildEventReportDocx(report);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${eventReportExportFilename(report)}"`,
    },
  });
}
