import { NextResponse } from "next/server";
import { calculateChapterBalance } from "@/lib/chapterBalance";
import { buildMeetingMinutesDocx, meetingMinutesFilename } from "@/lib/meetingMinutesExport";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Downloading the compiled Minutes is open to every logged-in member
// (Aug 2026 — "anyone should be able to export the minutes"); only
// *editing* officer reports (app/(app)/meetings-reports/minutes/[id])
// stays officer-only.
export async function GET(_request: Request, { params }: RouteParams) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { officerReports: true, notes: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }
  const members = await prisma.member.findMany({ select: { name: true, role: true, status: true, email: true } });

  // Chapter Balance (Sept 2026) — same starting-balance + deposits -
  // approved-Final-Budgets math as the Financial Books export (see
  // lib/chapterBalance.ts), fetched fresh on every export so the
  // Treasurer's report always shows the real current number rather than
  // whatever it was when the meeting was created.
  const [budgets, fundEntries, startingBalances] = await Promise.all([
    prisma.budget.findMany({
      include: { versions: { where: { stage: "FINAL" }, include: { lineItems: true } } },
    }),
    prisma.chapterFundEntry.findMany(),
    prisma.chapterStartingBalance.findMany({ orderBy: { year: "desc" } }),
  ]);
  const finalBudgets = budgets
    .filter((b) => b.versions.length > 0)
    .map((b) => ({ budget: b, version: b.versions[0] }));
  const chapterBalance =
    startingBalances[0] || fundEntries.length > 0 || finalBudgets.length > 0
      ? calculateChapterBalance(finalBudgets, fundEntries, startingBalances[0] ?? null)
      : null;

  const bytes = await buildMeetingMinutesDocx(meeting, meeting.officerReports, members, meeting.notes, chapterBalance);
  const file = new Uint8Array(bytes.length);
  file.set(bytes);

  return new NextResponse(new Blob([file]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${meetingMinutesFilename(meeting)}"`,
    },
  });
}
