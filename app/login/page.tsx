"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CHAPTER_ORG_NAME, CHAPTER_LABEL } from "@/lib/chapterConfig";

interface LoginMember {
  id: string;
  name: string;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<LoginMember[] | null>(null);
  const [memberId, setMemberId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/members")
      .then((res) => res.json())
      .then((data: LoginMember[]) => {
        setMembers(data);
        setMemberId(data[0]?.id ?? "");
      })
      .catch(() => setMembers([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    const redirectTo = searchParams.get("from") ?? "/";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-8 shadow-sm"
    >
      <h1 className="text-lg font-semibold text-stone-900">
        {CHAPTER_ORG_NAME} &mdash; {CHAPTER_LABEL}
      </h1>
      <p className="mt-1 text-sm text-stone-500">Sign in with your own account.</p>

      <label htmlFor="member" className="mt-6 block text-sm font-medium text-stone-700">
        Who are you?
      </label>
      {members === null ? (
        <p className="mt-1 text-sm text-stone-400">Loading...</p>
      ) : members.length === 0 ? (
        <p className="mt-1 text-sm text-stone-400">
          No accounts have been set up yet —{" "}
          <Link href="/signup" className="font-medium text-burgundy-600 hover:text-burgundy-800">
            request one
          </Link>
          .
        </p>
      ) : (
        <select
          id="member"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          autoFocus
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}

      <label htmlFor="password" className="mt-4 block text-sm font-medium text-stone-700">
        Password
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !memberId || password.length === 0}
        className="mt-6 w-full rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>

      <p className="mt-4 text-center text-sm text-stone-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-burgundy-600 hover:text-burgundy-800">
          Create your account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
