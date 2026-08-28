import { prisma } from "@/lib/prisma";
import { requireApproverPage } from "@/lib/session";
import { NotAuthorized } from "@/components/NotAuthorized";
import { PendingSignupsClient } from "./PendingSignupsClient";

// President, Vice President, or VP of Communications — see
// lib/permissions.ts canApproveSignups(). Not a Chapter Standards
// module, so off the sidebar for everyone else and not in
// lib/modules.ts, same as Manage Officers & Logins.
export default async function PendingSignupsPage() {
  const { allowed } = await requireApproverPage();
  if (!allowed) {
    return (
      <NotAuthorized
        moduleTitle="Pending Sign-Ups"
        positions={["Vice President", "Vice President of Communications"]}
      />
    );
  }

  const pending = await prisma.member.findMany({
    where: { approved: false },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Pending Sign-Ups</h1>
      <p className="mt-1 text-sm text-stone-500">
        Sisters who requested an account from the sign-up page — approve to let her log in, or
        deny to remove the request.
      </p>

      <div className="mt-6">
        <PendingSignupsClient initialPending={pending} />
      </div>
    </div>
  );
}
