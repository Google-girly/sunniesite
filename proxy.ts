import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, readSessionCookieValue } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  // Signature check only — this runs at the edge, no database
  // available. "Signed by someone who knows SESSION_SECRET" is enough
  // to let the request through; whether that memberId still exists (and
  // what she's allowed to do) is checked properly in
  // lib/session.ts getCurrentMember()/requirePageAccess() once we're in
  // a real Server Component or Route Handler.
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const memberId = readSessionCookieValue(cookieValue);

  if (!memberId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Every route runs through the check except the login and signup pages
// themselves, the auth API routes (login/signup need to be reachable
// while logged out), the cron route (Vercel Cron has no session cookie
// — it authenticates itself with CRON_SECRET instead, checked inside
// the route itself; see app/api/cron/meeting-reminders), and Next's own
// static assets.
export const config = {
  matcher: [
    "/((?!login|signup|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
