"use client";

import Link from "next/link";
import { useState } from "react";
import type { AccountEntry, Member } from "@/app/generated/prisma/client";
import { calculateBalance, formatCurrency } from "@/lib/fines";
import { MEMBER_STATUS_LABELS, type MemberStatus } from "@/lib/roster";

type MemberWithEntries = Member & { accountEntries: AccountEntry[] };

function sortByName(members: MemberWithEntries[]): MemberWithEntries[] {
  return [...members].sort((a, b) => a.name.localeCompare(b.name));
}

function BalancePill({ balance }: { balance: number }) {
  if (balance > 0) {
    return (
      <span className="inline-block rounded-full bg-burgundy-50 px-2 py-0.5 text-xs font-semibold text-burgundy-700">
        {formatCurrency(balance)} owed
      </span>
    );
  }
  if (balance < 0) {
    return (
      <span className="inline-block rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
        {formatCurrency(Math.abs(balance))} credit
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
      Paid up
    </span>
  );
}

export function FinesClient({ initialMembers }: { initialMembers: MemberWithEntries[] }) {
  const [members] = useState<MemberWithEntries[]>(sortByName(initialMembers));

  const withBalances = members.map((m) => ({
    member: m,
    balance: calculateBalance(m.accountEntries),
  }));

  const totalOwed = withBalances
    .filter((m) => m.balance > 0)
    .reduce((sum, m) => sum + m.balance, 0);
  const membersOwing = withBalances.filter((m) => m.balance > 0).length;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Total Owed to Chapter
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {formatCurrency(totalOwed)}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Members with a Balance
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">{membersOwing}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Name", "Role", "Status", "Balance", ""].map((h) => (
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
            {withBalances.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  No members on the roster yet. Add members on the Roster page first.
                </td>
              </tr>
            )}

            {withBalances.map(({ member, balance }) => (
              <tr key={member.id}>
                <td className="px-4 py-2.5 font-medium text-stone-900">{member.name}</td>
                <td className="px-4 py-2.5 text-stone-600">{member.role || "—"}</td>
                <td className="px-4 py-2.5 text-stone-600">
                  {MEMBER_STATUS_LABELS[member.status as MemberStatus] ?? member.status}
                </td>
                <td className="px-4 py-2.5">
                  <BalancePill balance={balance} />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <Link
                    href={`/fines/${member.id}`}
                    className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                  >
                    View Account
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
