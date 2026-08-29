"use client";

import { useState } from "react";
import type { Member } from "@/app/generated/prisma/client";
import { parseRoles } from "@/lib/roster";
import { confirmDelete } from "@/lib/confirmDelete";
import { PasswordInput } from "@/components/PasswordInput";
import { RoleDropdown } from "@/components/RoleDropdown";

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

// Email an invite (the /signup link + chapter password) to whoever's
// email address(es) get typed in here — not tied to the Roster/Member
// table at all (Aug 2026 rework: signup itself moved from "claim a
// Roster row" to open self-registration + officer approval, so there's
// no longer a fixed list of "unclaimed" people to invite from). One
// address per line or comma-separated.
function InviteSection() {
  const [emailsText, setEmailsText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const emails = emailsText
      .split(/[\n,]/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) return;

    setSending(true);
    setError(null);
    setStatus(null);
    const res = await fetch("/api/officers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });
    setSending(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Something went wrong. Please try again.");
      return;
    }
    const parts = [`${data.sent} invite${data.sent === 1 ? "" : "s"} sent.`];
    if (data.invalid?.length) parts.push(`Not valid email addresses: ${data.invalid.join(", ")}.`);
    if (data.failed?.length) parts.push(`Failed to send to: ${data.failed.join(", ")}.`);
    setStatus(parts.join(" "));
    if (data.sent > 0) setEmailsText("");
  }

  return (
    <div className="mb-6 rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-sm font-semibold text-stone-900">Invite a Sister to Sign Up</p>
      <p className="mt-1 text-sm text-stone-500">
        Emails the /signup link and chapter password. One address per line, or comma-separated.
      </p>
      <textarea
        value={emailsText}
        onChange={(e) => setEmailsText(e.target.value)}
        rows={2}
        placeholder="sister@example.com"
        className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={sending || emailsText.trim().length === 0}
          className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Invite(s)"}
        </button>
        {status && <p className="text-sm text-stone-600">{status}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function OfficerRow({
  member,
  onUpdated,
  canManageLogins,
}: {
  member: Member;
  onUpdated: (m: Member) => void;
  /** Setting/revoking a password is President-only, even now that positions are editable by VP/VP Comms too. */
  canManageLogins: boolean;
}) {
  const [roles, setRoles] = useState<string[]>(parseRoles(member.role));
  const [savingRoles, setSavingRoles] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSet, setPasswordSet] = useState(false);

  const dirty = roles.join("|") !== parseRoles(member.role).join("|");

  async function saveRoles() {
    setSavingRoles(true);
    setRoleError(null);
    const res = await fetch(`/api/officers/${member.id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: roles }),
    });
    setSavingRoles(false);
    if (!res.ok) {
      setRoleError(await parseError(res));
      return;
    }
    const updated: Member = await res.json();
    onUpdated(updated);
  }

  async function setMemberPassword() {
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    const res = await fetch(`/api/officers/${member.id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSavingPassword(false);
    if (!res.ok) {
      setPasswordError(await parseError(res));
      return;
    }
    setPassword("");
    setPasswordSet(true);
  }

  async function revokeLogin() {
    if (!confirmDelete(`Revoke ${member.name}'s login? She won't be able to sign in until a new password is set.`)) return;
    const res = await fetch(`/api/officers/${member.id}/password`, { method: "DELETE" });
    if (res.ok) {
      setPasswordSet(false);
      onUpdated({ ...member, passwordHash: null });
    } else {
      alert(await parseError(res));
    }
  }

  const hasLogin = passwordSet || !!member.passwordHash;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <p className="font-medium text-stone-900">{member.name}</p>
        <p className="mt-0.5">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              hasLogin ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
            }`}
          >
            {hasLogin ? "Has login" : "No login yet"}
          </span>
        </p>
      </td>
      <td className="px-4 py-3">
        <RoleDropdown value={roles} onChange={setRoles} />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={saveRoles}
            disabled={!dirty || savingRoles}
            className="rounded-md bg-burgundy-600 px-3 py-1 text-xs font-medium text-white hover:bg-burgundy-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingRoles ? "Saving..." : "Save positions"}
          </button>
          {roleError && <p className="text-xs text-red-600">{roleError}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        {!canManageLogins ? (
          <p className="text-xs text-stone-400">Only the President can set/revoke logins.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder={hasLogin ? "New password" : "Set a password"}
                inputClassName="w-48 rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
              />
              <button
                onClick={setMemberPassword}
                disabled={savingPassword || password.length === 0}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPassword ? "Saving..." : "Set"}
              </button>
              {hasLogin && (
                <button onClick={revokeLogin} className="text-xs font-medium text-stone-400 hover:text-red-600">
                  Revoke
                </button>
              )}
            </div>
            {passwordError && <p className="mt-1 text-xs text-red-600">{passwordError}</p>}
          </>
        )}
      </td>
    </tr>
  );
}

export function OfficersClient({
  initialMembers,
  canManageLogins,
}: {
  initialMembers: Member[];
  /** President-only, even though position editing itself is now open to VP/VP Comms too — see app/(app)/officers/page.tsx. */
  canManageLogins: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);

  function handleUpdated(updated: Member) {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  return (
    <div>
      {canManageLogins && <InviteSection />}

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Member", "Position(s)", "Password"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {members.map((m) => (
              <OfficerRow key={m.id} member={m} onUpdated={handleUpdated} canManageLogins={canManageLogins} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
