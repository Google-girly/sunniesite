import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ChapterAssistantWidget } from "@/components/ChapterAssistantWidget";
import { getCurrentMember } from "@/lib/session";

// This layout wraps every authenticated page (everything except
// /login) with the sidebar nav. It's a route group — "(app)" doesn't
// show up in the URL — so /roster is still just /roster.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already guarantees a validly-signed session cookie exists,
  // but not that the member behind it still exists (deleted account,
  // stale cookie) — this is the real, DB-backed check. Sidebar needs
  // the actual member anyway (to filter modules by position).
  const member = await getCurrentMember();
  if (!member) redirect("/login");

  return (
    // h-screen (not min-h-screen) pins this row to exactly the viewport
    // height, so Sidebar (h-full) and <main>'s own overflow-y-auto each
    // get an independent scroll region — a long page (e.g. Official
    // Standards Forms) scrolls its own content while the sidebar stays
    // put, instead of the whole page scrolling the sidebar out of view.
    <div className="flex h-screen">
      <Sidebar member={member} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
      <ChapterAssistantWidget />
    </div>
  );
}
