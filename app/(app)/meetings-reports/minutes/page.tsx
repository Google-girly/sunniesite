import { prisma } from "@/lib/prisma";
import { MinutesListClient } from "./MinutesListClient";

export default async function MinutesPage() {
  const [meetings, schedules] = await Promise.all([
    prisma.meeting.findMany({
      include: { officerReports: true },
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
        officer-only; exporting the finished minutes is open to everyone below. The
        export fills in the date/time, each position&apos;s current holder(s) from Roster, and the
        current Active Roster. Roll call, motions, and Meeting Adjourned are still filled in by
        hand after export.
      </p>

      <div className="mt-6">
        <MinutesListClient initialMeetings={meetings} schedules={schedules} />
      </div>
    </div>
  );
}
