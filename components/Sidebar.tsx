"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Member } from "@/app/generated/prisma/client";
import { MODULES } from "@/lib/modules";
import { canAccessModule, isPresident, type ModuleKey } from "@/lib/permissions";
import { parseRoles } from "@/lib/roster";
import { LogoutButton } from "@/components/LogoutButton";
import { CHAPTER_ORG_NAME, CHAPTER_LABEL } from "@/lib/chapterConfig";

function NavLink({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: string;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "border-gold-400 bg-burgundy-900/60 text-gold-200"
          : "border-transparent text-stone-300 hover:border-gold-400/40 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span>{label}</span>
      {badge && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-200">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ member }: { member: Member }) {
  const roles = parseRoles(member.role);
  // Only "locked" modules actually disappear — self-service/open-submit
  // modules are always usable in some form (your own stuff, at least),
  // so hiding them would be misleading. See lib/permissions.ts.
  const visibleModules = MODULES.filter((mod) => canAccessModule(member, mod.key as ModuleKey));

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-gold-900/40 bg-stone-950">
      <div className="border-b border-gold-400/20 px-5 py-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-400">
          {CHAPTER_ORG_NAME}
        </p>
        <p className="text-xs text-stone-400">{CHAPTER_LABEL} &middot; Admin</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink href="/" label="Dashboard" />

        <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gold-700">
          Modules
        </p>
        {visibleModules.map((mod) => (
          <NavLink
            key={mod.key}
            href={mod.href}
            label={mod.title}
            badge={mod.status === "planned" ? "Soon" : undefined}
          />
        ))}

        {isPresident(member) && (
          <>
            <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gold-700">
              President
            </p>
            <NavLink href="/officers" label="Manage Officers & Logins" />
          </>
        )}
      </nav>

      <div className="border-t border-gold-400/20 p-3">
        <p className="truncate px-3 text-sm font-medium text-white">{member.name}</p>
        <p className="truncate px-3 pb-2 text-xs text-stone-400">
          {roles.length > 0 ? roles.join(", ") : "General member"}
        </p>
        <Link
          href="/account"
          className="block rounded-md px-3 py-1.5 text-sm text-stone-300 hover:bg-white/5 hover:text-white"
        >
          My Account
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}
