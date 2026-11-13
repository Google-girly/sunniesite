"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { requestConfirm } from "@/lib/feedback";

// Warns before leaving a long-form page with typed-but-unsaved work
// (Nov 2026) — Budget versions, Meeting Minutes, Event Reports.
//
// Deliberately generic so the big client components don't each need
// their own dirty-tracking: typing in any field inside the wrapper marks
// it dirty; submitting a form inside it, or clicking a button marked
// `data-saves` (or Enter in a field marked `data-saves-on-enter`), marks
// it clean again. Covers both closing/reloading the
// tab (beforeunload) and clicking an in-app link (sidebar, breadcrumbs),
// which beforeunload alone doesn't catch for client-side navigation.
export function UnsavedChangesGuard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.type === "file") return; // uploads save immediately
      dirty.current = true;
    };
    const onSubmit = () => {
      dirty.current = false;
    };
    const onLocalClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-saves]")) dirty.current = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.target as HTMLElement).closest("[data-saves-on-enter]")) dirty.current = false;
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    const onLinkClick = (e: MouseEvent) => {
      if (!dirty.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab/window keeps this page
      const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      void requestConfirm({
        message: "You have unsaved changes on this page. Leave without saving?",
        confirmLabel: "Leave page",
      }).then((leave) => {
        if (leave) {
          dirty.current = false;
          router.push(url.pathname + url.search + url.hash);
        }
      });
    };

    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);
    el.addEventListener("submit", onSubmit);
    el.addEventListener("click", onLocalClick);
    el.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onLinkClick, true);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("change", onInput);
      el.removeEventListener("submit", onSubmit);
      el.removeEventListener("click", onLocalClick);
      el.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onLinkClick, true);
    };
  }, [router]);

  return <div ref={ref}>{children}</div>;
}
