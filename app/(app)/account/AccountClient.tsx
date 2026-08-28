"use client";

import { useState } from "react";

export function AccountClient() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Please try again.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-stone-900">Change Password</h2>

      <label className="mt-4 block text-xs font-medium text-stone-600">Current password</label>
      <input
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
      />

      <label className="mt-3 block text-xs font-medium text-stone-600">New password</label>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
      />

      <label className="mt-3 block text-xs font-medium text-stone-600">Confirm new password</label>
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
      />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-green-700">Password updated.</p>}

      <button
        type="submit"
        disabled={saving || !currentPassword || newPassword.length === 0}
        className="mt-4 w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : "Update password"}
      </button>
    </form>
  );
}
