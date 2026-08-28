import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePresidentApi } from "@/lib/session";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { CHAPTER_ORG_NAME, CHAPTER_LABEL } from "@/lib/chapterConfig";

// President-only "invite a sister to sign up" (Aug 2026) — sends an
// email with a link to /signup plus the shared SIGNUP_PASSWORD, from
// the same chapter Gmail account already configured for meeting-minutes
// reminders (see lib/email.ts — nothing new to set up here, this just
// reuses it). Only ever emails members who (a) don't have a login yet
// and (b) have an email on file — never re-invites someone who's
// already claimed her account, and never guesses at an address.
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
  // Explicit list of member ids to invite, or omitted/empty to mean
  // "everyone who doesn't have a login yet."
  const requestedIds = Array.isArray(body?.memberIds)
    ? body.memberIds.filter((id: unknown): id is string => typeof id === "string")
    : null;

  const candidates = await prisma.member.findMany({
    where: {
      passwordHash: null,
      ...(requestedIds ? { id: { in: requestedIds } } : {}),
    },
  });

  const invitable = candidates.filter((m) => m.email);
  const skippedNoEmail = candidates.filter((m) => !m.email).map((m) => m.name);

  const base = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const signupUrl = `${base}/signup`;
  const signupPassword = process.env.SIGNUP_PASSWORD;

  let sent = 0;
  const failed: string[] = [];
  for (const member of invitable) {
    const text = [
      `Hi ${member.name},`,
      "",
      `You're invited to create your account on the ${CHAPTER_ORG_NAME}, ${CHAPTER_LABEL} admin site.`,
      "",
      `1. Go to: ${signupUrl}`,
      `2. Chapter password: ${signupPassword}`,
      `3. Pick your name from the list and set your own password.`,
      "",
      `— ${CHAPTER_LABEL}`,
    ].join("\n");
    const html = `
      <p>Hi ${member.name},</p>
      <p>You're invited to create your account on the ${CHAPTER_ORG_NAME}, ${CHAPTER_LABEL} admin site.</p>
      <ol>
        <li>Go to: <a href="${signupUrl}">${signupUrl}</a></li>
        <li>Chapter password: <strong>${signupPassword}</strong></li>
        <li>Pick your name from the list and set your own password.</li>
      </ol>
      <p>— ${CHAPTER_LABEL}</p>
    `;
    try {
      await sendEmail({
        to: [member.email as string],
        subject: `You're invited — ${CHAPTER_ORG_NAME} ${CHAPTER_LABEL} sign up`,
        text,
        html,
      });
      sent++;
    } catch {
      failed.push(member.name);
    }
  }

  return NextResponse.json({ ok: true, sent, skippedNoEmail, failed });
}
