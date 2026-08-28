"use client";

import Link from "next/link";
import { useState } from "react";
import { CHAPTER_ORG_NAME, CHAPTER_LABEL } from "@/lib/chapterConfig";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      body: JSON.stringify({ name, email, phone, signupPassword, password }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Try again.");
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
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
            <input
              id="chapter-password"
              type="password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              autoFocus
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
            <p className="mt-1 text-xs text-stone-400">Ask an officer if you don&apos;t know it.</p>

            <label htmlFor="name" className="mt-4 block text-sm font-medium text-stone-700">
              Your Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />

            <label htmlFor="email" className="mt-4 block text-sm font-medium text-stone-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />

            <label htmlFor="phone" className="mt-4 block text-sm font-medium text-stone-700">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />

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
              disabled={submitting || !name || !email || !phone || password.length === 0}
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
