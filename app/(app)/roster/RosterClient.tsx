"use client";

import Link from "next/link";
import { useState } from "react";
import type { Member } from "@/app/generated/prisma/client";
import { MEMBER_STATUSES, MEMBER_STATUS_LABELS, type MemberStatus } from "@/lib/roster";
import { confirmDelete } from "@/lib/confirmDelete";

interface FormValues {
  name: string;
  status: MemberStatus;
  crossingTerm: string;
  email: string;
  class: string;
  crossingNumber: string;
  nickname: string;
}

const EMPTY_FORM: FormValues = {
  name: "",
  status: "ACTIVE",
  crossingTerm: "",
  email: "",
  class: "",
  crossingNumber: "",
  nickname: "",
};

function memberToForm(member: Member): FormValues {
  return {
    name: member.name,
    status: MEMBER_STATUSES.includes(member.status as MemberStatus)
      ? (member.status as MemberStatus)
      : "ACTIVE",
    crossingTerm: member.crossingTerm ?? "",
    email: member.email ?? "",
    class: member.class ?? "",
    crossingNumber: member.crossingNumber != null ? String(member.crossingNumber) : "",
    nickname: member.nickname ?? "",
  };
}

// Ordered by Line #, not name — matches the real Chapter Roster
// Template's own crossing order. Members with no number on file (not
// yet backfilled) sort to the end rather than interleaving at "0".
function sortByLineNumber(members: Member[]): Member[] {
  return [...members].sort((a, b) => {
    if (a.crossingNumber == null && b.crossingNumber == null) return a.name.localeCompare(b.name);
    if (a.crossingNumber == null) return 1;
    if (b.crossingNumber == null) return -1;
    return a.crossingNumber - b.crossingNumber;
  });
}

const STATUS_BADGE_CLASSES: Record<MemberStatus, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  ACTIVE_SPECIAL_CIRCUMSTANCE: "bg-amber-50 text-amber-700",
  INACTIVE: "bg-stone-100 text-stone-500",
  ACTIVE_ALUMNAE: "bg-purple-50 text-purple-700",
};

function StatusBadge({ status }: { status: string }) {
  const known = MEMBER_STATUSES.includes(status as MemberStatus)
    ? (status as MemberStatus)
    : "ACTIVE";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[known]}`}
    >
      {MEMBER_STATUS_LABELS[known]}
    </span>
  );
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

export function RosterClient({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState<Member[]>(sortByLineNumber(initialMembers));
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<FormValues>(EMPTY_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormValues>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim()) {
      setAddError("Name is required.");
      return;
    }
    setAdding(true);
    setAddError(null);

    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });

    setAdding(false);

    if (!res.ok) {
      setAddError(await parseError(res));
      return;
    }

    const created: Member = await res.json();
    setMembers((prev) => sortByLineNumber([...prev, created]));
    setAddForm(EMPTY_FORM);
    setShowAddForm(false);
  }

  function startEdit(member: Member) {
    setEditingId(member.id);
    setEditForm(memberToForm(member));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.name.trim()) {
      setEditError("Name is required.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);

    const res = await fetch(`/api/roster/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    setSavingEdit(false);

    if (!res.ok) {
      setEditError(await parseError(res));
      return;
    }

    const updated: Member = await res.json();
    setMembers((prev) => sortByLineNumber(prev.map((m) => (m.id === id ? updated : m))));
    setEditingId(null);
  }

  async function handleDelete(member: Member) {
    if (!confirmDelete(`Remove ${member.name} from the roster?`)) return;
    setDeletingId(member.id);
    const res = await fetch(`/api/roster/${member.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } else {
      alert(await parseError(res));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {members.length} member{members.length === 1 ? "" : "s"} &middot; positions (Role) are
          set from Manage Officers &amp; Logins, not here.
        </p>
        <button
          onClick={() => {
            setShowAddForm((prev) => !prev);
            setAddError(null);
          }}
          className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700"
        >
          {showAddForm ? "Cancel" : "Add Member"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Class <span className="text-stone-400">(e.g. ΑΒ)</span>
            </label>
            <input
              value={addForm.class}
              onChange={(e) => setAddForm({ ...addForm, class: e.target.value })}
              placeholder="e.g. ΑΒ or Founding"
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Line #</label>
            <input
              type="number"
              value={addForm.crossingNumber}
              onChange={(e) => setAddForm({ ...addForm, crossingNumber: e.target.value })}
              placeholder="e.g. 47"
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Name</label>
            <input
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              autoFocus
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Nickname</label>
            <input
              value={addForm.nickname}
              onChange={(e) => setAddForm({ ...addForm, nickname: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Status</label>
            <select
              value={addForm.status}
              onChange={(e) =>
                setAddForm({ ...addForm, status: e.target.value as MemberStatus })
              }
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            >
              {MEMBER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {MEMBER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">
              Crossing Term
            </label>
            <input
              value={addForm.crossingTerm}
              onChange={(e) => setAddForm({ ...addForm, crossingTerm: e.target.value })}
              placeholder="e.g. Fall 2024"
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600">Email</label>
            <input
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-5">
            {addError && <p className="mb-2 text-sm text-red-600">{addError}</p>}
            <button
              type="submit"
              disabled={adding}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add to roster"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {[
                "Class",
                "Line #",
                "Name",
                "Nickname",
                "Role",
                "Status",
                "Crossing Term",
                "Email",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {members.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-stone-400">
                  No members yet. Add the first one above.
                </td>
              </tr>
            )}

            {members.map((member) => {
              const isEditing = editingId === member.id;

              if (isEditing) {
                return (
                  <tr key={member.id} className="bg-burgundy-50/40">
                    <td className="px-4 py-2">
                      <input
                        value={editForm.class}
                        onChange={(e) =>
                          setEditForm({ ...editForm, class: e.target.value })
                        }
                        className="w-24 rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editForm.crossingNumber}
                        onChange={(e) =>
                          setEditForm({ ...editForm, crossingNumber: e.target.value })
                        }
                        className="w-20 rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.nickname}
                        onChange={(e) =>
                          setEditForm({ ...editForm, nickname: e.target.value })
                        }
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-stone-400" title="Positions are set from Manage Officers & Logins, not here.">
                      {member.role || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            status: e.target.value as MemberStatus,
                          })
                        }
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      >
                        {MEMBER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {MEMBER_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.crossingTerm}
                        onChange={(e) =>
                          setEditForm({ ...editForm, crossingTerm: e.target.value })
                        }
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm({ ...editForm, email: e.target.value })
                        }
                        className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(member.id)}
                            disabled={savingEdit}
                            className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800 disabled:opacity-50"
                          >
                            {savingEdit ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-sm font-medium text-stone-500 hover:text-stone-700"
                          >
                            Cancel
                          </button>
                        </div>
                        {editError && (
                          <p className="text-xs text-red-600">{editError}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={member.id}>
                  <td className="px-4 py-2.5 text-stone-600">{member.class || "—"}</td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {member.crossingNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-stone-900">
                    {member.name}
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">{member.nickname || "—"}</td>
                  <td className="px-4 py-2.5 text-stone-600">{member.role || "—"}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={member.status} />
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {member.crossingTerm || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">
                    {member.email || "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <Link
                      href={`/fines/${member.id}`}
                      className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                    >
                      Account
                    </Link>
                    <button
                      onClick={() => startEdit(member)}
                      className="ml-3 text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(member)}
                      disabled={deletingId === member.id}
                      className="ml-3 text-sm font-medium text-stone-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
