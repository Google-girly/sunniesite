import { NextResponse } from "next/server";
import { requirePresidentApi } from "@/lib/session";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { CHAPTER_ORG_NAME, CHAPTER_LABEL } from "@/lib/chapterConfig";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// President-only "invite a sister to sign up" (Aug 2026, reworked when
// signup itself moved from "claim a Roster row" to open self-registration
// — see app/api/auth/signup). This no longer touches the Roster or
// Member table at all: it's just an email with the /signup link and the
// shared SIGNUP_PASSWORD, sent to whatever address(es) the President
// types in. From the same chapter Gmail account already configured for
// meeting-minutes reminders (lib/email.ts) — nothing new to set up here.
export async function POST(request: Request) {
  const access = await requirePresidentApi();
  if ("error" in access) return access.error;

  if (!process.env.SIGNUP_PASSWORD) {
    return NextResponse.json(
      { error: "Signup isn't configured yet — set SIGNUP_PASSWORD first." },
      { status: 500 }
    );
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email isn't configured yet — set GMAIL_USER / GMAIL_APP_PASSWORD first (see .env.example)." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const rawEmails: unknown[] = Array.isArray(body?.emails) ? body.emails : [];
  const strings = rawEmails.filter((e): e is string => typeof e === "string").map((e) => e.trim());
  const emails: string[] = [...new Set(strings.filter((e) => EMAIL_RE.test(e)))];
  const invalid: string[] = strings.filter((e) => e && !EMAIL_RE.test(e));

  if (emails.length === 0) {
    return NextResponse.json({ error: "Enter at least one valid email address." }, { status: 400 });
  }

  const base = (process.env.APP_BASE_URL || "https://montereysunnies.vercel.app").replace(/\/$/, "");
  const signupUrl = `${base}/signup`;
  const signupPassword = process.env.SIGNUP_PASSWORD;

  const text = [
    `You're invited to join the ${CHAPTER_ORG_NAME}, ${CHAPTER_LABEL} admin site.`,
    "",
    `1. Go to: ${signupUrl}`,
    `2. Chapter password: ${signupPassword}`,
    `3. Fill out the form and request an account — an officer approves each new request, so it may take a bit before you can log in.`,
    "",
    `— ${CHAPTER_LABEL}`,
  ].join("\n");
  const html = `
    <p>You're invited to join the ${CHAPTER_ORG_NAME}, ${CHAPTER_LABEL} admin site.</p>
    <ol>
      <li>Go to: <a href="${signupUrl}">${signupUrl}</a></li>
      <li>Chapter password: <strong>${signupPassword}</strong></li>
      <li>Fill out the form and request an account — an officer approves each new request, so it may take a bit before you can log in.</li>
    </ol>
    <p>— ${CHAPTER_LABEL}</p>
  `;

  let sent = 0;
  const failed: string[] = [];
  for (const email of emails) {
    try {
      await sendEmail({
        to: [email],
        subject: `You're invited — ${CHAPTER_ORG_NAME} ${CHAPTER_LABEL} sign up`,
        text,
        html,
      });
      sent++;
    } catch {
      failed.push(email);
    }
  }

  return NextResponse.json({ ok: true, sent, failed, invalid });
}
