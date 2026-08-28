"use client";

import { useEffect, useRef, useState } from "react";
import type { Member } from "@/app/generated/prisma/client";
import { OFFICER_POSITIONS } from "@/lib/positions";
import { parseRoles } from "@/lib/roster";
import { confirmDelete } from "@/lib/confirmDelete";

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

// Same multi-select-checkboxes-in-a-dropdown pattern Roster used to
// have inline — moved here since position assignment is now
// President-only and lives only on this page.
function RoleDropdown({ value, onChange }: { value: string[]; onChange: (roles: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleRole(role: string) {
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full min-w-64 items-center justify-between rounded-md border border-stone-300 bg-white px-2 py-1.5 text-left text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
      >
        <span className={value.length > 0 ? "text-stone-900" : "text-stone-400"}>
          {value.length > 0 ? value.join(", ") : "General member"}
        </span>
        <span className="ml-2 shrink-0 text-stone-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full min-w-64 overflow-y-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg">
          {OFFICER_POSITIONS.map((role) => (
            <label key={role} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-stone-50">
              <input
                type="checkbox"
                checked={value.includes(role)}
                onChange={() => toggleRole(role)}
                className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-400"
              />
              {role}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function OfficerRow({ member, onUpdated }: { member: Member; onUpdated: (m: Member) => void }) {
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
            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingRoles ? "Saving..." : "Save positions"}
          </button>
          {roleError && <p className="text-xs text-red-600">{roleError}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={hasLogin ? "New password" : "Set a password"}
            className="w-40 rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
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
      </td>
    </tr>
  );
}

export function OfficersClient({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);

  function handleUpdated(updated: Member) {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  return (
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
            <OfficerRow key={m.id} member={m} onUpdated={handleUpdated} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
