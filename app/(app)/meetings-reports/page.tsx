import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";
import { NotAuthorized } from "@/components/NotAuthorized";
import { MeetingScheduleClient } from "./MeetingScheduleClient";

export default async function MeetingsReportsPage() {
  // Open-submit — every member can get in to submit her own Officer
  // Report, so `allowed` here is never actually false. Editing the
  // schedule/meetings themselves is a narrower, position-gated action —
  // see canManage below and lib/permissions.ts.
  const { member, allowed } = await requirePageAccess("meetings-reports");
  if (!allowed) return <NotAuthorized moduleTitle="Meetings & Reports" positions={["President"]} />;
  const canManage = ownsModule(member, "meetings-reports");

  const schedules = await prisma.meetingSchedule.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Meetings &amp; Reports</h1>
        </div>
        <Link
          href="/meetings-reports/minutes"
          className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700"
        >
          Meeting Minutes →
        </Link>
      </div>

      <div className="mt-6">
        <MeetingScheduleClient initialSchedules={schedules} canManage={canManage} />
      </div>
    </div>
  );
}
