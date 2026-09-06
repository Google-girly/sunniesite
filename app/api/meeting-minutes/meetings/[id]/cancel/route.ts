import { NextResponse } from "next/server";
import { requireModuleOwnerApi } from "@/lib/session";
import { cancelMeetingAndMoveContent } from "@/lib/meetingCancel";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Same Secretary/Historian/President gate as the rest of this meeting's
// own management (PATCH/DELETE in ../route.ts) — cancelling reassigns
// real content (Officer Reports, notes, attachments, pending Budgets/
// Letters) onto another meeting, not something to leave open to every
// officer. See lib/meetingCancel.ts for what actually moves.
export async function POST(_request: Request, { params }: RouteParams) {
  const access = await requireModuleOwnerApi("meetings-reports");
  if ("error" in access) return access.error;

  const { id } = await params;
  const outcome = await cancelMeetingAndMoveContent(id);
  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(outcome.result);
}
