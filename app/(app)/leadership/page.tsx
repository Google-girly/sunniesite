import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { LeadershipClient } from "./LeadershipClient";

// Chapter Standards credits about chapter governance/leadership with no
// other home: A.4 (Chapter Advisor), F.5 (Annual Strategic Plan /
// Progress Report), F.6/F.7 (Individual Leadership Positions). F.4
// (Officer Transition Meetings) used to live here too — removed Aug
// 2026 in favor of an Event Report (see lib/eventReports.ts). Split out
// of the old, single "Official Standards Forms" data-entry page — see
// MODULES.md.
export default async function LeadershipPage() {
  const { allowed } = await requirePageAccess("leadership");
  if (!allowed) return <NotAuthorized moduleTitle="Leadership" positions={["President"]} />;

  const [members, chapterAdvisors, strategicPlanGoals, leadershipPositions] = await Promise.all([
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    prisma.chapterAdvisor.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.strategicPlanGoal.findMany({ orderBy: [{ academicYear: "desc" }, { createdAt: "asc" }] }),
    prisma.leadershipPosition.findMany({ orderBy: [{ academicYear: "desc" }, { createdAt: "asc" }] }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Leadership</h1>

      <div className="mt-6">
        <LeadershipClient
          members={members}
          initialChapterAdvisors={chapterAdvisors}
          initialStrategicPlanGoals={strategicPlanGoals}
          initialLeadershipPositions={leadershipPositions}
        />
      </div>
    </div>
  );
}
