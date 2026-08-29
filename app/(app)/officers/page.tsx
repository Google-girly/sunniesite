import { prisma } from "@/lib/prisma";
import { requireEditPositionsPage } from "@/lib/session";
import { isPresident } from "@/lib/permissions";
import { NotAuthorized } from "@/components/NotAuthorized";
import { PendingSignupsPanel } from "@/components/PendingSignupsPanel";
import { OfficersClient } from "./OfficersClient";

// President, Vice President, or Vice President of Communications (Aug
// 2026 — was President-only) — assigns positions (the `role` field
// every other module's access check reads, see lib/permissions.ts).
// Setting/revoking a login password and sending sign-up invites stay
// President-only within this same page — see OfficersClient's
// `canManageLogins` prop. Not a Chapter Standards module, so it's off
// the sidebar for everyone else rather than living in lib/modules.ts.
export default async function OfficersPage() {
  const { member, allowed } = await requireEditPositionsPage();
  if (!allowed) {
    return (
      <NotAuthorized
        moduleTitle="Manage Officers & Logins"
        positions={["Vice President", "Vice President of Communications"]}
      />
    );
  }

  const members = await prisma.member.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">Manage Officers &amp; Logins</h1>
        <PendingSignupsPanel buttonClassName="flex items-center gap-2 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50" />
      </div>

      <div className="mt-6">
        <OfficersClient initialMembers={members} canManageLogins={isPresident(member)} />
      </div>
    </div>
  );
}
