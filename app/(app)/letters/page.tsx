import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { LettersClient } from "./LettersClient";

// "A place where people can just use the official letter head for
// whatever they need" (Aug 2026) — any logged-in member can create one;
// the President sees every letter ever created (see
// app/api/letters/route.ts), everyone else sees just her own.
export default async function LettersPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");

  const canSeeAll = ownsModule(member, "letters");
  // Aug 2026 — drafts stay isolated to whoever created them, even from
  // the President, until finalized or added to a meeting's minutes —
  // matches app/api/letters/route.ts GET exactly.
  const letters = await prisma.letter.findMany({
    where: canSeeAll ? { OR: [{ isDraft: false }, { createdByMemberId: member.id }] } : { createdByMemberId: member.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Official Letterhead</h1>
      <p className="mt-1 text-sm text-stone-500">
        Generate a letter on the chapter&apos;s real letterhead — Letter of Excuse, Active Member
        Request, or anything else. Every letter is logged with its date, who created it, and what
        it was for{canSeeAll ? " — you can see every letter below, as President." : "."}
      </p>

      <div className="mt-6">
        <LettersClient initialLetters={letters} viewerId={member.id} canSeeAll={canSeeAll} />
      </div>
    </div>
  );
}
