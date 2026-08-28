import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/session";
import { parseRoles } from "@/lib/roster";
import { AccountClient } from "./AccountClient";

export default async function AccountPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  const roles = parseRoles(member.role);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">My Account</h1>
      <p className="mt-1 text-sm text-stone-500">
        Signed in as <span className="font-medium text-stone-700">{member.name}</span>
        {roles.length > 0 ? ` — ${roles.join(", ")}` : " — general member"}.
      </p>

      <div className="mt-6 max-w-sm">
        <AccountClient />
      </div>
    </div>
  );
}
