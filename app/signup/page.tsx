"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CHAPTER_ORG_NAME, CHAPTER_LABEL } from "@/lib/chapterConfig";

interface UnclaimedMember {
  id: string;
  name: string;
}

export default function SignupPage() {
  const router = useRouter();
  const [members, setMembers] = useState<UnclaimedMember[] | null>(null);
  const [memberId, setMemberId] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/unclaimed-members")
      .then((res) => res.json())
      .then((data: UnclaimedMember[]) => {
        setMembers(data);
        setMemberId(data[0]?.id ?? "");
      })
      .catch(() => setMembers([]));
  }, []);

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
      body: JSON.stringify({ memberId, signupPassword, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-stone-900">
          {CHAPTER_ORG_NAME} &mdash; {CHAPTER_LABEL}
        </h1>
        <p className="mt-1 text-sm text-stone-500">Create your account.</p>

        {members !== null && members.length === 0 ? (
          <p className="mt-6 text-sm text-stone-500">
            Every sister on the Roster already has an account.{" "}
            <Link href="/login" className="font-medium text-burgundy-600 hover:text-burgundy-800">
              Log in instead
            </Link>
            , or ask the President to add you to the Roster first if you&apos;re new.
          </p>
        ) : (
          <>
            <label htmlFor="chapter-password" className="mt-6 block text-sm font-medium text-stone-700">
              Chapter Password
            </label>
            <input
              id="chapter-password"
              type="password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              autoFocus
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
            <p className="mt-1 text-xs text-stone-400">Ask an officer if you don&apos;t know it.</p>

            <label htmlFor="member" className="mt-4 block text-sm font-medium text-stone-700">
              Who are you?
            </label>
            {members === null ? (
              <p className="mt-1 text-sm text-stone-400">Loading...</p>
            ) : (
              <select
                id="member"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-stone-400">
              Not on this list? You either already have an account (
              <Link href="/login" className="font-medium text-burgundy-600 hover:text-burgundy-800">
                log in
              </Link>
              ) or the President hasn&apos;t added you to the Roster yet.
            </p>

            <label htmlFor="password" className="mt-4 block text-sm font-medium text-stone-700">
              Set a Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />

            <label htmlFor="confirm-password" className="mt-4 block text-sm font-medium text-stone-700">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !memberId || password.length === 0}
              className="mt-6 w-full rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating account..." : "Create Account"}
            </button>

            <p className="mt-4 text-center text-sm text-stone-500">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-burgundy-600 hover:text-burgundy-800">
                Log in
              </Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
