import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { canAccessModule, ownsModule } from "@/lib/permissions";
import { NotAuthorized } from "@/components/NotAuthorized";
import { CommunityServiceClient } from "./CommunityServiceClient";

// Server component: reads every Active/Inactive member plus her logged
// hours for the initial render (totals/progress computed client-side,
// see lib/communityService.ts calculateServiceTotals) — mirrors the
// Fines list page's pattern.
//
// Self-service (Aug 2026): a general member sees only her own row here
// — the Commissioner of Community Service (or President) sees
// everyone's. See lib/permissions.ts.
export default async function CommunityServicePage() {
  const viewer = await getCurrentMember();
  if (!viewer) redirect("/login");
  if (!canAccessModule(viewer, "community-service")) {
    return <NotAuthorized moduleTitle="Community Service" positions={["Commissioner of Community Service"]} />;
  }
  const canSeeEveryone = ownsModule(viewer, "community-service");

  const members = await prisma.member.findMany({
    where: canSeeEveryone
      ? { status: { in: ["ACTIVE", "INACTIVE"] } }
      : { id: viewer.id },
    orderBy: { name: "asc" },
    include: { serviceHours: true, makeUpProjects: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Community Service</h1>
      {!canSeeEveryone && (
        <p className="mt-1 text-sm text-stone-500">
          You&apos;re seeing only your own log — the Commissioner of Community Service and
          President see everyone&apos;s.
        </p>
      )}

      <div className="mt-6">
        <CommunityServiceClient initialMembers={members} canManageAll={canSeeEveryone} />
      </div>
    </div>
  );
}
