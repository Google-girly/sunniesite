import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { FinesClient } from "./FinesClient";

// Server component: reads every member plus her ledger entries for the
// initial render (balances are computed client-side, see lib/fines.ts
// calculateBalance) — mirrors the Roster page's pattern.
export default async function FinesPage() {
  const { allowed } = await requirePageAccess("fines");
  if (!allowed) return <NotAuthorized moduleTitle="Fines & Member Accounts" positions={["Treasurer"]} />;

  const members = await prisma.member.findMany({
    orderBy: { name: "asc" },
    include: { accountEntries: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Fines &amp; Member Accounts</h1>

      <div className="mt-6">
        <FinesClient initialMembers={members} />
      </div>
    </div>
  );
}
