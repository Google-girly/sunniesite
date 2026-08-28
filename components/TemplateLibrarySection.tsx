"use client";

import Link from "next/link";
import { Section, th, td } from "@/components/FormSection";
import { TEMPLATE_LIBRARY } from "@/lib/templateLibrary";

// A read-only index over lib/templates/ — every blank template the
// chapter uses, in one place, plus a link over to that module's own
// live export where one exists (a real filled-in version from current
// data, generated the same way it always has been). See
// lib/templateLibrary.ts for the list itself.
export function TemplateLibrarySection() {
  return (
    <Section
      title="Template Library"
      description="Every blank chapter template in one place — click a title to jump to its live section, or download the blank form directly."
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead>
            <tr>
              <th className={th}>Template</th>
              <th className={th}>Description</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {TEMPLATE_LIBRARY.map((t) => (
              <tr key={t.key}>
                <td className={`${td} font-medium`}>
                  {t.liveHref ? (
                    <Link href={t.liveHref} className="text-burgundy-600 hover:text-burgundy-800">
                      {t.title}
                    </Link>
                  ) : (
                    <span className="text-stone-900">{t.title}</span>
                  )}
                </td>
                <td className={`${td} text-stone-600`}>{t.description}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <a href={`/api/templates/${t.key}`} className="font-medium text-burgundy-600 hover:text-burgundy-800">
                    Download blank
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
