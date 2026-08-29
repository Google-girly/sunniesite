"use client";

import Link from "next/link";
import { useState } from "react";
import { CHAPTER_ORG_NAME, CHAPTER_LABEL } from "@/lib/chapterConfig";
import { PasswordInput } from "@/components/PasswordInput";
import { MEMBER_STATUSES, MEMBER_STATUS_LABELS } from "@/lib/roster";
import { RoleDropdown } from "@/components/RoleDropdown";

const fieldLabel = "mt-4 block text-sm font-medium text-stone-700";
const fieldInput =
  "mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [memberClass, setMemberClass] = useState("");
  const [crossingNumber, setCrossingNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [status, setStatus] = useState<(typeof MEMBER_STATUSES)[number]>("ACTIVE");
  const [crossingTerm, setCrossingTerm] = useState("");
  const [notes, setNotes] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        class: memberClass,
        crossingNumber,
        nickname,
        roles,
        status,
        crossingTerm,
        notes,
        signupPassword,
        password,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Try again.");
      return;
    }

    setSubmitted(true);
  }

  const requiredFilled =
    name.trim().split(/\s+/).filter(Boolean).length >= 2 &&
    memberClass.trim() &&
    crossingNumber.trim() &&
    nickname.trim() &&
    status &&
    crossingTerm.trim() &&
    email &&
    phone &&
    password.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-stone-900">
          {CHAPTER_ORG_NAME} &mdash; {CHAPTER_LABEL}
        </h1>
        <p className="mt-1 text-sm text-stone-500">Create your account.</p>

        {submitted ? (
          <p className="mt-6 text-sm text-stone-600">
            Request sent! The President, Vice President, or VP of Communications still needs to
            approve it before you can log in — check back soon, or ask one of them to take a look.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="chapter-password" className="mt-6 block text-sm font-medium text-stone-700">
              Chapter Password
            </label>
            <PasswordInput
              id="chapter-password"
              value={signupPassword}
              onChange={setSignupPassword}
              autoFocus
              inputClassName={fieldInput}
            />
            <p className="mt-1 text-xs text-stone-400">Ask an officer if you don&apos;t know it.</p>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-stone-400">
              Roster Info — all required, matches the real Chapter Roster
            </p>

            <label htmlFor="name" className={fieldLabel}>
              Full Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First Last"
              className={fieldInput}
            />
            <p className="mt-1 text-xs text-stone-400">First and last name — matches how you&apos;ll show up on the Roster.</p>

            <label htmlFor="nickname" className={fieldLabel}>
              Nickname
            </label>
            <input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className={fieldInput} />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="class" className="block text-sm font-medium text-stone-700">
                  Class
                </label>
                <input
                  id="class"
                  value={memberClass}
                  onChange={(e) => setMemberClass(e.target.value)}
                  placeholder="e.g. ΑΒ or Founding"
                  className={fieldInput}
                />
              </div>
              <div>
                <label htmlFor="line-number" className="block text-sm font-medium text-stone-700">
                  Line #
                </label>
                <input
                  id="line-number"
                  type="number"
                  value={crossingNumber}
                  onChange={(e) => setCrossingNumber(e.target.value)}
                  placeholder="e.g. 47"
                  className={fieldInput}
                />
              </div>
            </div>

            <label className={fieldLabel}>Role</label>
            <RoleDropdown value={roles} onChange={setRoles} emptyLabel="General member (no position)" />
            <p className="mt-1 text-xs text-stone-400">Check every position you hold, if any.</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-stone-700">
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as (typeof MEMBER_STATUSES)[number])}
                  className={fieldInput}
                >
                  {MEMBER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {MEMBER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="crossing-term" className="block text-sm font-medium text-stone-700">
                  Crossing Term
                </label>
                <input
                  id="crossing-term"
                  value={crossingTerm}
                  onChange={(e) => setCrossingTerm(e.target.value)}
                  placeholder="e.g. Fall 2024"
                  className={fieldInput}
                />
              </div>
            </div>

            <label htmlFor="email" className={fieldLabel}>
              Email
            </label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldInput} />

            <label htmlFor="phone" className={fieldLabel}>
              Phone Number
            </label>
            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldInput} />

            <label htmlFor="notes" className={fieldLabel}>
              Notes <span className="text-stone-400">(optional)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything else the approving officer should know"
              className={fieldInput}
            />
            <p className="mt-1 text-xs text-stone-400">Not required.</p>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-stone-400">Login</p>

            <label htmlFor="password" className={fieldLabel}>
              Set a Password
            </label>
            <PasswordInput id="password" value={password} onChange={setPassword} inputClassName={fieldInput} />

            <label htmlFor="confirm-password" className={fieldLabel}>
              Confirm Password
            </label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              inputClassName={fieldInput}
            />

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !requiredFilled}
              className="mt-6 w-full rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Request Account"}
            </button>

            <p className="mt-4 text-center text-sm text-stone-500">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-burgundy-600 hover:text-burgundy-800">
                Log in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
