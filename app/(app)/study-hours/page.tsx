import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";
import { StudyHoursClient } from "./StudyHoursClient";

// Server component: reads every Active/Inactive member plus her logged
// study sessions for the initial render (weekly completion computed
// client-side, see lib/studyHours.ts calculateWeeklyCompletion) —
// mirrors the Community Service list page's pattern.
//
// Self-service (Aug 2026): a general member sees only her own row here
// — the Vice President (or President) sees everyone's, same as she
// always could. See lib/permissions.ts.
export default async function StudyHoursPage() {
  const viewer = await getCurrentMember();
  if (!viewer) redirect("/login");
  const canSeeEveryone = ownsModule(viewer, "study-hours");

  const members = await prisma.member.findMany({
    where: canSeeEveryone
      ? { status: { in: ["ACTIVE", "INACTIVE"] } }
      : { id: viewer.id },
    orderBy: { name: "asc" },
    include: { studyHours: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Study Hours</h1>
      {!canSeeEveryone && (
        <p className="mt-1 text-sm text-stone-500">
          You&apos;re seeing only your own log — the Vice President and President see everyone&apos;s.
        </p>
      )}

      <div className="mt-6">
        <StudyHoursClient initialMembers={members} canExport={canSeeEveryone} />
      </div>
    </div>
  );
}
