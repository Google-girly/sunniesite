import { prisma } from "@/lib/prisma";
import { requirePresidentPage } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { OfficersClient } from "./OfficersClient";

// President-only — assigns positions (the `role` field every other
// module's access check reads, see lib/permissions.ts) and provisions
// logins. Not a Chapter Standards module, so it's off the sidebar for
// everyone but the President rather than living in lib/modules.ts.
export default async function OfficersPage() {
  const { allowed } = await requirePresidentPage();
  if (!allowed) {
    return <NotAuthorized moduleTitle="Manage Officers & Logins" positions={["President"]} />;
  }

  const members = await prisma.member.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Manage Officers &amp; Logins</h1>

      <div className="mt-6">
        <OfficersClient initialMembers={members} />
      </div>
    </div>
  );
}
