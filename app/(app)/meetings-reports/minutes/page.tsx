import { prisma } from "@/lib/prisma";
import { MinutesListClient } from "./MinutesListClient";

export default async function MinutesPage() {
  const [meetings, schedules] = await Promise.all([
    prisma.meeting.findMany({
      include: {
        officerReports: true,
        // fileName only — enough to show a download link without
        // pulling every meeting's finished-minutes blob along with this
        // list. See app/api/meeting-minutes/meetings/[id]/final-minutes/
        // route.ts for the actual download.
        finalMinutes: { select: { id: true, fileName: true } },
      },
      // Most recent/soonest meeting first, farthest-out last (Aug 2026
      // — "arrange the meeting minutes from most recent to farthest
      // out"). Ascending date puts the nearest one on top.
      orderBy: { date: "asc" },
    }),
    prisma.meetingSchedule.findMany({ where: { active: true } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Meeting Minutes</h1>
      <p className="mt-1 text-sm text-stone-500">
        One record per actual meeting date. Opening a meeting to edit its officer reports is
        officer-only. &quot;Export&quot; below gives anyone the auto-filled draft — date/time, each
        position&apos;s current holder(s) from Roster, and the current Active Roster, with roll
        call, motions, and Meeting Adjourned still blank for an officer to fill in by hand. Once
        that&apos;s done, &quot;Finished Minutes&quot; is the officer-uploaded, completed file — open
        to everyone to view or download as soon as it&apos;s posted.
      </p>

      <div className="mt-6">
        <MinutesListClient initialMeetings={meetings} schedules={schedules} />
      </div>
    </div>
  );
}
