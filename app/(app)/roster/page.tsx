import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { RosterClient } from "./RosterClient";

// Server component: reads straight from the database for the initial
// render, then hands off to the client component for add/edit/remove.
export default async function RosterPage() {
  const { allowed } = await requirePageAccess("roster");
  if (!allowed) {
    return <NotAuthorized moduleTitle="the Officer & Active Roster" positions={["President"]} />;
  }

  const members = await prisma.member.findMany({
    orderBy: [{ crossingNumber: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">
        Officer &amp; Active Roster
      </h1>

      <div className="mt-6">
        <RosterClient initialMembers={members} />
      </div>
    </div>
  );
}
