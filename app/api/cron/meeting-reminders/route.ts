import { NextResponse } from "next/server";
import { sendMeetingRemindersDueTomorrow } from "@/lib/meetingReminders";

// Triggered by Vercel Cron (see vercel.json — once daily). Vercel signs
// every cron request with `Authorization: Bearer $CRON_SECRET`
// automatically once CRON_SECRET is set as an env var in the project —
// this route just has to check it matches, same secret on both sides.
// Without a valid CRON_SECRET configured, this route refuses every
// request rather than running unauthenticated (anyone who found the URL
// could otherwise trigger chapter-wide emails on demand).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const results = await sendMeetingRemindersDueTomorrow();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    // Most likely cause: GMAIL_USER/GMAIL_APP_PASSWORD not set yet —
    // see lib/email.ts. Surfaced as a real error rather than a silent
    // 200 so a broken reminder pipeline shows up in Vercel's cron logs.
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
