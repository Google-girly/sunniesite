import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/session";
import { ownsModule } from "@/lib/permissions";
import { resolveCurrentVotingPeriod } from "@/lib/sisterOfMonthVoting";

// The "general consensus" ballot — every Active member gets one vote,
// for any Active sister, tallied live. Self-service by design (not
// gated to whoever owns Sisterhood): the whole point is the general
// membership deciding, not one officer. See lib/sisterOfMonthVoting.ts
// for how the voting period/deadline is derived and MODULES.md for the
// fuller design writeup.
export async function GET() {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const period = await resolveCurrentVotingPeriod();
  if (!period) {
    return NextResponse.json({ open: false, period: null });
  }

  const [votes, alreadyDecided] = await Promise.all([
    prisma.sisterOfMonthVote.findMany({
      where: { year: period.year, month: period.month },
      include: { nominee: true },
    }),
    prisma.sisterOfTheMonth.findUnique({
      where: { year_month: { year: period.year, month: period.month } },
    }),
  ]);

  const myVote = votes.find((v) => v.voterId === viewer.id);

  // Aug 2026 — "I only want cultura and sisterhood to be able to see
  // who won sister of the month." Every Active member still gets one
  // vote (the whole point of a general-consensus ballot), but the
  // per-nominee tally — which reveals who's currently leading/would win
  // — is only handed back to whoever owns Sisterhood (the Commissioner
  // of Cultura and Sisterhood, or the President). Everyone else still
  // gets the total vote count so the ballot doesn't feel like a black
  // box, just not the breakdown by name.
  const canSeeResults = ownsModule(viewer, "sisterhood");
  const tally = new Map<string, { member: { id: string; name: string }; count: number }>();
  for (const v of votes) {
    const existing = tally.get(v.nomineeId);
    if (existing) existing.count++;
    else tally.set(v.nomineeId, { member: { id: v.nominee.id, name: v.nominee.name }, count: 1 });
  }
  const results = [...tally.values()].sort((a, b) => b.count - a.count);

  return NextResponse.json({
    open: !alreadyDecided,
    period,
    ...(canSeeResults ? { results } : {}),
    totalVotes: votes.length,
    myVote: myVote ? myVote.nomineeId : null,
  });
}

export async function POST(request: Request) {
  const viewer = await getCurrentMember();
  if (!viewer) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (viewer.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only Active members can vote." }, { status: 403 });
  }

  const period = await resolveCurrentVotingPeriod();
  if (!period) {
    return NextResponse.json({ error: "There's no ballot open right now." }, { status: 400 });
  }

  const alreadyDecided = await prisma.sisterOfTheMonth.findUnique({
    where: { year_month: { year: period.year, month: period.month } },
  });
  if (alreadyDecided) {
    return NextResponse.json({ error: "This month's Sister of the Month has already been confirmed." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const nomineeId = typeof body?.nomineeId === "string" ? body.nomineeId : "";
  if (!nomineeId) {
    return NextResponse.json({ error: "Pick who you're voting for." }, { status: 400 });
  }
  const nominee = await prisma.member.findUnique({ where: { id: nomineeId } });
  if (!nominee || nominee.status !== "ACTIVE") {
    return NextResponse.json({ error: "You can only vote for an Active member." }, { status: 400 });
  }

  const vote = await prisma.sisterOfMonthVote.upsert({
    where: { year_month_voterId: { year: period.year, month: period.month, voterId: viewer.id } },
    create: { year: period.year, month: period.month, voterId: viewer.id, nomineeId },
    update: { nomineeId },
  });
  return NextResponse.json(vote);
}
