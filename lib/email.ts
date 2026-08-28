// Outbound email (Aug 2026) — a chapter Gmail account via SMTP + an
// "App Password" (Google Account → Security → 2-Step Verification →
// App Passwords; requires 2FA to be on for that account first). Not
// Gmail's API — plain SMTP through nodemailer, so there's no OAuth
// consent flow to build or maintain, just two env vars.
//
// GMAIL_USER: the full chapter Gmail address that will send these.
// GMAIL_APP_PASSWORD: the 16-character App Password (not the account's
//   normal login password — that won't work here since it's protected
//   by 2FA, which is exactly what App Passwords are for).
//
// If either is unset, send() throws rather than silently no-opping —
// callers (the cron route) catch that and log it clearly instead of
// pretending a reminder went out when it didn't.
import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER / GMAIL_APP_PASSWORD are not set — see .env.example. Email sending is not configured."
    );
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

/** So callers (e.g. the President's "invite to sign up" route) can give one clear error up front instead of every individual send failing the same way. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Uint8Array }[];
}

// Gmail's own sending limits (500 recipients/day on a regular Google
// Workspace-less account) are nowhere near a concern at chapter size,
// so this just sends one message with everyone in `to` — recipients
// can see each other's addresses (no bcc), same as replying-all on a
// normal group email, which is the expected chapter norm here.
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: process.env.GMAIL_USER,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content) })),
  });
}
