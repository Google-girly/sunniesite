// Per-member auth (Aug 2026) — replaced the old single shared
// APP_PASSWORD. Each Member has her own password (`passwordHash`, set
// by the President from Manage Officers & Logins); the login session
// cookie identifies *who* is logged in, not just *that* someone knows a
// password, so lib/permissions.ts can gate features by that member's
// `role` (her position(s) on the roster). Still no email delivery /
// self-serve signup — this is a small trusted group, and the President
// provisions accounts directly.
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";

export const SESSION_COOKIE_NAME = "son_session";

const SCRYPT_KEYLEN = 64;

// --- Password hashing (scrypt, Node's built-in — no extra dependency
// needed for a small app like this) -----------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  // Lengths must match before timingSafeEqual will even compare —
  // guard first rather than let it throw on a malformed stored hash.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// --- Session cookie: "<memberId>.<hmac>" ------------------------------
// Signed rather than encrypted — the memberId itself isn't secret (it's
// a cuid, not guessable, and every page already checks who's allowed to
// see what via lib/permissions.ts), the signature just stops someone
// from editing the cookie in devtools to claim a different member's id.

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to your .env file (see .env.example)."
    );
  }
  return secret;
}

function sign(memberId: string): string {
  return createHmac("sha256", getSessionSecret()).update(memberId).digest("hex");
}

export function buildSessionCookieValue(memberId: string): string {
  return `${memberId}.${sign(memberId)}`;
}

/** Verifies the cookie's signature and returns the memberId, or null if missing/invalid. */
export function readSessionCookieValue(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot === -1) return null;
  const memberId = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  const expected = sign(memberId);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;
  return memberId;
}
