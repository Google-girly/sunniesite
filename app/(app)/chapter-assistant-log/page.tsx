import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";

// Read-only log of every question asked of the Chapter Assistant, open to
// every logged-in member (same "open" spirit as the assistant itself —
// see MODULES.md) — not on the sidebar, reached via a link in the widget
// itself, since this is a secondary/diagnostic view rather than a module.
// Point of this page: spot documentation gaps (a low "Confidence" score
// means the docs probably don't actually cover that question) and see
// what members have flagged with a thumbs down.
export default async function ChapterAssistantLogPage() {
  const viewer = await getCurrentMember();
  if (!viewer) redirect("/login");

  const interactions = await prisma.chapterAssistantInteraction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { member: { select: { name: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">La Mujer Question Log</h1>
      <p className="mt-1 text-sm text-stone-500">
        The last 100 questions asked of La Mujer, the chat widget. &ldquo;Confidence&rdquo; is
        the best retrieval match score for that question — a low one usually means the chapter
        documents don&apos;t actually cover it, which is worth adding.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Asked by</th>
              <th className="px-4 py-2">Question</th>
              <th className="px-4 py-2">Answer</th>
              <th className="px-4 py-2">Sources</th>
              <th className="px-4 py-2">Confidence</th>
              <th className="px-4 py-2">Feedback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {interactions.map((row) => {
              const sources: { name: string }[] = JSON.parse(row.sources || "[]");
              return (
                <tr key={row.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-stone-500">
                    {row.createdAt.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-stone-700">
                    {row.member?.name ?? "—"}
                  </td>
                  <td className="max-w-xs px-4 py-2 text-stone-800">{row.question}</td>
                  <td className="max-w-md px-4 py-2 text-stone-600">
                    <details>
                      <summary className="cursor-pointer text-rose-700">
                        {row.answer ? `${row.answer.slice(0, 80)}${row.answer.length > 80 ? "…" : ""}` : "(no answer saved)"}
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap">{row.answer}</p>
                    </details>
                  </td>
                  <td className="max-w-[10rem] px-4 py-2 text-stone-500">
                    {sources.map((s) => s.name).join(", ") || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-stone-500">
                    {row.topScore != null ? row.topScore.toFixed(2) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {row.feedback === "up" && <span title="Thumbs up">👍</span>}
                    {row.feedback === "down" && <span title="Thumbs down">👎</span>}
                    {!row.feedback && <span className="text-stone-300">—</span>}
                  </td>
                </tr>
              );
            })}
            {interactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-stone-400">
                  No questions asked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
