import { prisma } from "@/lib/prisma";
import { MinutesListClient } from "./MinutesListClient";

export default async function MinutesPage() {
  const [meetings, schedules] = await Promise.all([
    prisma.meeting.findMany({
      include: { officerReports: true },
      orderBy: { date: "desc" },
    }),
    prisma.meetingSchedule.findMany({ where: { active: true } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Meeting Minutes</h1>
      <p className="mt-1 text-sm text-stone-500">
        One record per actual meeting date. Officers submit their reports here; the export fills
        them onto the real Minutes template along with the date/time, each position&apos;s current
        holder(s) from Roster, and the current Active Roster. Roll call, motions, Business/Old
        Business, and the rest of the minutes are still filled in by hand after export.
      </p>

      <div className="mt-6">
        <MinutesListClient initialMeetings={meetings} schedules={schedules} />
      </div>
    </div>
  );
}
