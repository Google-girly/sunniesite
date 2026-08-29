import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { canAccessModule, isPresident } from "@/lib/permissions";
import { NotAuthorized } from "@/components/NotAuthorized";
import { EventReportsClient } from "./EventReportsClient";

export default async function EventReportsPage() {
  const viewer = await getCurrentMember();
  if (!viewer) redirect("/login");
  if (!canAccessModule(viewer, "event-reports")) {
    return <NotAuthorized moduleTitle="Event Reports" positions={[]} />;
  }

  const [reports, members] = await Promise.all([
    prisma.eventReport.findMany({
      include: { signerMember: true },
      orderBy: { date: "desc" },
    }),
    prisma.member.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Event Reports</h1>

      <div className="mt-6">
        <EventReportsClient
          members={members}
          initialReports={reports}
          viewerId={viewer.id}
          viewerIsPresident={isPresident(viewer)}
        />
      </div>
    </div>
  );
}
