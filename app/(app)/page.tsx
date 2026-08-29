import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MODULES } from "@/lib/modules";
import { canAccessModule, type ModuleKey } from "@/lib/permissions";
import { getCurrentMember } from "@/lib/session";
import { SisterOfMonthBallotCard } from "@/components/SisterOfMonthBallotCard";
import { MyToDoList } from "@/components/MyToDoList";
import { getMyToDoItems } from "@/lib/toDoList";
import { CHAPTER_FULL_NAME } from "@/lib/chapterConfig";

export default async function DashboardPage() {
  // Same filtering as the Sidebar — a locked module's card shouldn't
  // show up here either, even though NotAuthorized would catch a click
  // through anyway. Missed this the first time the permission system
  // went in; the sidebar was filtered but the dashboard itself wasn't.
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  const visibleModules = MODULES.filter((mod) => canAccessModule(member, mod.key as ModuleKey));

  const memberCount = await prisma.member.count();
  // Only fetched/shown for Active members — they're the only ones who
  // can actually vote (see lib/sisterOfMonthVoting.ts). A general
  // member sees the ballot right here rather than needing access to
  // the (locked) Sisterhood module just to vote.
  const activeMembers =
    member.status === "ACTIVE"
      ? await prisma.member.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } })
      : [];
  const toDoItems = await getMyToDoItems(member);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">
            {CHAPTER_FULL_NAME} — exec board admin tools.
          </p>
        </div>
        {/* Aug 2026 — "add this link to the dashboard as linktree." */}
        <a
          href="https://linktr.ee/montereysunnies"
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Linktree ↗
        </a>
      </div>

      <div className="mt-6">
        <MyToDoList items={toDoItems} />
      </div>

      {member.status === "ACTIVE" && (
        <div className="mt-6">
          <SisterOfMonthBallotCard activeMembers={activeMembers} />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleModules.map((mod) => (
          <Link
            key={mod.key}
            href={mod.href}
            className="rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-burgundy-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-medium text-stone-900">{mod.title}</h2>
              {mod.status === "planned" && (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  Soon
                </span>
              )}
            </div>
            {mod.key === "roster" && (
              <p className="mt-3 text-sm font-medium text-burgundy-700">
                {memberCount} member{memberCount === 1 ? "" : "s"} on file
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
