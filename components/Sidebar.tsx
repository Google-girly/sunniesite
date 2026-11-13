"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Member } from "@/app/generated/prisma/client";
import { MODULE_GROUPS, MODULES } from "@/lib/modules";
import { canAccessModule, canEditPositions, type ModuleKey } from "@/lib/permissions";
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
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-burgundy-50 text-burgundy-700"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      <span>{label}</span>
      {badge && (
        <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
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

  // Below the md breakpoint the sidebar becomes a slide-in drawer behind
  // a hamburger in a slim top bar (Nov 2026) — a fixed 256px column left
  // almost nothing for the page itself on a phone.
  // Stores the path the drawer was opened on, so navigating anywhere
  // closes it without an effect.
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const mobileOpen = openedOn === pathname;
  const setMobileOpen = (open: boolean) => setOpenedOn(open ? pathname : null);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:hidden">
        <p className="text-sm font-semibold uppercase tracking-wide text-burgundy-700">
          {CHAPTER_ORG_NAME}
        </p>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="rounded-md p-2 text-stone-600 hover:bg-stone-100"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-stone-900/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-stone-200 bg-white transition-transform md:static md:h-full md:translate-x-0 ${
        mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
      }`}
    >
      <div className="flex items-start justify-between border-b border-stone-200 px-5 py-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-burgundy-700">
            {CHAPTER_ORG_NAME}
          </p>
          <p className="text-xs text-stone-500">{CHAPTER_LABEL} &middot; Admin</p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          className="-mr-2 rounded-md px-2 text-xl leading-none text-stone-400 hover:text-stone-700 md:hidden"
        >
          ×
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink href="/" label="Dashboard" />

        {MODULE_GROUPS.map((group) => {
          const groupModules = visibleModules.filter((mod) => mod.group === group);
          if (groupModules.length === 0) return null;
          return (
            <div key={group} className="space-y-1">
              <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                {group}
              </p>
              {groupModules.map((mod) => (
                <NavLink
                  key={mod.key}
                  href={mod.href}
                  label={mod.title}
                  badge={mod.status === "planned" ? "Soon" : undefined}
                />
              ))}
            </div>
          );
        })}

        {/* Manage Officers & Logins (Aug 2026 — was President-only):
            President, Vice President, or Vice President of
            Communications, per lib/permissions.ts canEditPositions().
            Pending Sign-Ups' own trigger now lives on that page
            (components/PendingSignupsPanel.tsx), not here. */}
        {canEditPositions(member) && (
          <>
            <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Officer Tools
            </p>
            <NavLink href="/officers" label="Manage Officers & Logins" />
          </>
        )}
      </nav>

      <div className="border-t border-stone-200 p-3">
        <p className="truncate px-3 text-sm font-medium text-stone-800">{member.name}</p>
        <p className="truncate px-3 pb-2 text-xs text-stone-400">
          {roles.length > 0 ? roles.join(", ") : "General member"}
        </p>
        <Link
          href="/account"
          className="block rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        >
          My Account
        </Link>
        <LogoutButton />
      </div>
    </aside>
    </>
  );
}
