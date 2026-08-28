import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentTerm } from "@/lib/communityService";
import { formatMeetingDate, OFFICER_POSITIONS, OFFICER_REPORT_TEMPLATE_LABELS } from "@/lib/meetingMinutes";
import { ACTIVE_ROSTER_ROW_CAPACITY, meetingMinutesFilename, parseIsoDateLocal } from "@/lib/meetingMinutesExport";
import { findRoleHolderNames } from "@/lib/roster";
import { CHAPTER_FULL_NAME } from "@/lib/chapterConfig";
import { PrintButton } from "./PrintButton";

// "Open the final version" of a meeting's minutes on its own page (Aug
// 2026) — mirrors exactly what the real docx export
// (lib/meetingMinutesExport.ts) fills in: Date, Meeting Call to Order,
// the Active Roster capped at the template's real 4-row capacity, and
// every officer position's current holder(s) + submitted report. Roll
// Call, motions, Business/Old Business etc. stay out of scope here too
// — same as the docx, those are filled by hand.
export default async function FinalMinutesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: { officerReports: true },
  });
  if (!meeting) notFound();

  const members = await prisma.member.findMany({ select: { name: true, role: true, status: true } });

  const term = currentTerm(parseIsoDateLocal(meeting.date));
  const activeNames = members
    .filter((m) => m.status === "ACTIVE")
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, ACTIVE_ROSTER_ROW_CAPACITY);
  const reportsByPosition = new Map(meeting.officerReports.map((r) => [r.position, r.report]));

  return (
    <div>
      {/* Hidden when printing — only .print-area shows, via the global
          print rules below. */}
      <div className="no-print">
        <Link
          href={`/meetings-reports/minutes/${meeting.id}`}
          className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
        >
          ← Back to This Meeting
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">Final Version</h1>
          <div className="flex items-center gap-3">
            <a
              href={`/api/meeting-minutes/export/${meeting.id}`}
              download={meetingMinutesFilename(meeting)}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Download .docx
            </a>
            <PrintButton />
          </div>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          A read-only preview of the compiled Minutes, filled in exactly like the .docx export.
          &quot;Print / Save as PDF&quot; opens your browser&apos;s print dialog — choose &quot;Save
          as PDF&quot; there for an actual PDF file.
        </p>
      </div>

      <div className="print-area mt-6 max-w-3xl rounded-lg border border-stone-200 bg-white p-8 text-stone-900">
        <h2 className="text-center text-lg font-semibold uppercase tracking-wide">
          {CHAPTER_FULL_NAME} — Meeting Minutes
        </h2>
        <p className="mt-1 text-center text-sm text-stone-600">
          Date: {formatMeetingDate(meeting.date)} &nbsp;·&nbsp; Meeting Call to Order:{" "}
          {meeting.time || "—"}
        </p>

        <div className="mt-6">
          <h3 className="font-semibold">Active Roster {term}</h3>
          <ul className="mt-1 list-inside list-disc text-sm">
            {activeNames.length === 0 ? (
              <li className="text-stone-400">No Active members on file.</li>
            ) : (
              activeNames.map((name) => <li key={name}>{name}</li>)
            )}
          </ul>
        </div>

        <div className="mt-6 space-y-4">
          {OFFICER_POSITIONS.map((position, i) => {
            const holders = findRoleHolderNames(members, position);
            const report = reportsByPosition.get(position)?.trim();
            return (
              <div key={position}>
                <h3 className="font-semibold">
                  {String.fromCharCode(65 + i)}. {OFFICER_REPORT_TEMPLATE_LABELS[position].trim()} (
                  {holders || "—"})
                </h3>
                <p className="ml-4 mt-1 whitespace-pre-line text-sm text-stone-700">
                  {report || "No report submitted."}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plain (non-scoped) <style> — intentionally reaches outside this
          page to hide the app shell's <aside> sidebar while printing,
          since that's a layout.tsx sibling this page can't otherwise
          touch. Only active while this page is mounted. */}
      <style>{`
        @media print {
          aside { display: none !important; }
          .no-print { display: none !important; }
          .print-area { border: none !important; padding: 0 !important; max-width: none !important; }
        }
      `}</style>
    </div>
  );
}
