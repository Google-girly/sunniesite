"use client";

import { useState } from "react";
import type { ChapterAdvisor, LeadershipPosition, Member, StrategicPlanGoal } from "@/app/generated/prisma/client";
import { LetterSignoffFields } from "@/components/LetterSignoffFields";
import {
  currentAcademicYear,
  LEADERSHIP_CATEGORIES,
  LEADERSHIP_CATEGORY_LABELS,
  PLAN_PERIODS,
  PLAN_PERIOD_LABELS,
  STRATEGIC_GOAL_STATUSES,
  STRATEGIC_PRIORITY_AREAS,
  type LeadershipCategory,
  type PlanPeriod,
} from "@/lib/standardsForms";
import { Section, inputClass, labelClass, th, td, parseFormError as parseError } from "@/components/FormSection";
import { confirmDelete } from "@/lib/confirmDelete";

function ChapterAdvisorSection({ initial }: { initial: ChapterAdvisor[] }) {
  const [records, setRecords] = useState(initial);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/chapter-advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, title, email, phone, officeAddress }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    setRecords((prev) => [created, ...prev]);
    setName("");
    setTitle("");
    setEmail("");
    setPhone("");
    setOfficeAddress("");
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this Chapter Advisor record?")) return;
    const res = await fetch(`/api/standards/chapter-advisor/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section title="Section A.4 — Chapter Advisor" description="Name, position/title, email, phone, and office address, on file.">
      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Position/Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Office Address</label>
          <input value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-3 flex items-center gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add"}
          </button>
          <a href={`/api/standards/chapter-advisor/export`} className="text-sm font-medium text-rose-600 hover:text-rose-800">
            Export Letter
          </a>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Name", "Title", "Email", "Phone", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-stone-400">
                  No advisor on file.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.name}</td>
                <td className={td}>{r.title || "—"}</td>
                <td className={td}>{r.email || "—"}</td>
                <td className={td}>{r.phone || "—"}</td>
                <td className={`${td} text-right`}>
                  <button onClick={() => handleDelete(r.id)} className="text-xs font-medium text-stone-400 hover:text-red-600">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// --- §F.5: Annual Strategic Plan / Progress Report --------------------------


function StrategicPlanSection({ initial, members }: { initial: StrategicPlanGoal[]; members: Member[] }) {
  const [goals, setGoals] = useState(initial);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [period, setPeriod] = useState<PlanPeriod>("YEAR");
  const [priorityArea, setPriorityArea] = useState<string>(STRATEGIC_PRIORITY_AREAS[0]);
  const [goalDescription, setGoalDescription] = useState("");
  const [responsibleOfficer, setResponsibleOfficer] = useState("");
  const [targetTimeline, setTargetTimeline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = goals.filter((g) => g.academicYear === academicYear && g.period === period);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/strategic-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYear, period, priorityArea, goalDescription, responsibleOfficer, targetTimeline }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    setGoals((prev) => [...prev, created]);
    setGoalDescription("");
    setResponsibleOfficer("");
    setTargetTimeline("");
  }

  async function handleUpdate(id: string, patch: { status?: string; progressNotes?: string }) {
    const res = await fetch(`/api/standards/strategic-plan/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
    } else {
      alert(await parseError(res));
    }
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this strategic plan goal?")) return;
    const res = await fetch(`/api/standards/strategic-plan/${id}`, { method: "DELETE" });
    if (res.ok) setGoals((prev) => prev.filter((g) => g.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Section F.5 — Annual Strategic Plan"
      description="3-5 measurable priorities by Sept 15; progress on the same goals by Jan 31."
    >
      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <label className={labelClass}>Academic Year</label>
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2026-2027"
            className={`${inputClass} max-w-xs`}
          />
        </div>
        <div>
          <label className={labelClass}>Period</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value as PlanPeriod)} className={`${inputClass} max-w-xs`}>
            {PLAN_PERIODS.map((p) => (
              <option key={p} value={p}>
                {PLAN_PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Priority Area</label>
          <select value={priorityArea} onChange={(e) => setPriorityArea(e.target.value)} className={inputClass}>
            {STRATEGIC_PRIORITY_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Responsible Officer</label>
          <input value={responsibleOfficer} onChange={(e) => setResponsibleOfficer(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Goal</label>
          <input
            value={goalDescription}
            onChange={(e) => setGoalDescription(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Target Timeline</label>
          <input value={targetTimeline} onChange={(e) => setTargetTimeline(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Goal"}
          </button>
          <a
            href={`/api/standards/strategic-plan/export?academicYear=${encodeURIComponent(academicYear)}&period=${period}&variant=PLAN`}
            className="text-sm font-medium text-rose-600 hover:text-rose-800"
          >
            Export Plan
          </a>
          <a
            href={`/api/standards/strategic-plan/export?academicYear=${encodeURIComponent(academicYear)}&period=${period}&variant=PROGRESS`}
            className="text-sm font-medium text-rose-600 hover:text-rose-800"
          >
            Export Progress Report
          </a>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Priority", "Goal", "Officer", "Status", "Progress Notes", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-400">
                  No goals for {academicYear} ({PLAN_PERIOD_LABELS[period]}).
                </td>
              </tr>
            )}
            {filtered.map((g) => (
              <tr key={g.id}>
                <td className={td}>{g.priorityArea}</td>
                <td className={td}>{g.goalDescription}</td>
                <td className={td}>{g.responsibleOfficer || "—"}</td>
                <td className={td}>
                  <select
                    value={g.status}
                    onChange={(e) => handleUpdate(g.id, { status: e.target.value })}
                    className="rounded border border-stone-300 px-1.5 py-1 text-xs"
                  >
                    {STRATEGIC_GOAL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={td}>
                  <input
                    defaultValue={g.progressNotes ?? ""}
                    onBlur={(e) => handleUpdate(g.id, { progressNotes: e.target.value })}
                    className="w-full rounded border border-stone-300 px-1.5 py-1 text-xs"
                  />
                </td>
                <td className={`${td} text-right`}>
                  <button onClick={() => handleDelete(g.id)} className="text-xs font-medium text-stone-400 hover:text-red-600">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-stone-100 pt-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-stone-800">President&apos;s Signature — Plan</p>
          <LetterSignoffFields
            key={`${academicYear}:${period}:PLAN`}
            section="strategic-plan"
            signoffKey={`${academicYear}:${period}:PLAN`}
            members={members}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-stone-800">President&apos;s Signature — Progress Report</p>
          <LetterSignoffFields
            key={`${academicYear}:${period}:PROGRESS`}
            section="strategic-plan"
            signoffKey={`${academicYear}:${period}:PROGRESS`}
            members={members}
          />
        </div>
      </div>
    </Section>
  );
}

// --- §F.6/§F.7: Individual Leadership Positions -----------------------------


function LeadershipPositionSection({ initial, members }: { initial: LeadershipPosition[]; members: Member[] }) {
  const [records, setRecords] = useState(initial);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [memberId, setMemberId] = useState("");
  const [memberName, setMemberName] = useState("");
  const [organization, setOrganization] = useState("");
  const [position, setPosition] = useState("");
  const [category, setCategory] = useState<LeadershipCategory>("GREEK");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = records.filter((r) => r.academicYear === academicYear);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/leadership-positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYear,
        memberId: memberId || undefined,
        memberName,
        organization,
        position,
        category,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    setRecords((prev) => [...prev, created]);
    setMemberId("");
    setMemberName("");
    setOrganization("");
    setPosition("");
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this leadership position record?")) return;
    const res = await fetch(`/api/standards/leadership-positions/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Section F.6/F.7 — Individual Leadership Positions"
      description="Members holding an officer position in an outside organization, Greek or non-Greek related."
    >
      <div className="mb-4">
        <label className={labelClass}>Academic Year</label>
        <input
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="2026-2027"
          className={`${inputClass} max-w-xs`}
        />
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Member (from Roster)</label>
          <select
            value={memberId}
            onChange={(e) => {
              setMemberId(e.target.value);
              const m = members.find((mm) => mm.id === e.target.value);
              if (m) setMemberName(m.name);
            }}
            className={inputClass}
          >
            <option value="">— Not on Roster / other —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Member Name</label>
          <input value={memberName} onChange={(e) => setMemberName(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as LeadershipCategory)} className={inputClass}>
            {LEADERSHIP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {LEADERSHIP_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Organization</label>
          <input value={organization} onChange={(e) => setOrganization(e.target.value)} className={inputClass} required />
        </div>
        <div>
          <label className={labelClass}>Position Held</label>
          <input value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} required />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
        <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <a
            href={`/api/standards/leadership-positions/export?academicYear=${encodeURIComponent(academicYear)}&category=GREEK`}
            className="text-sm font-medium text-rose-600 hover:text-rose-800"
          >
            Export Greek Related (F.6)
          </a>
          <a
            href={`/api/standards/leadership-positions/export?academicYear=${encodeURIComponent(academicYear)}&category=NON_GREEK`}
            className="text-sm font-medium text-rose-600 hover:text-rose-800"
          >
            Export Non-Greek Related (F.7)
          </a>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Member", "Category", "Organization", "Position", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-stone-400">
                  No leadership positions for {academicYear}.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.memberName}</td>
                <td className={td}>{LEADERSHIP_CATEGORY_LABELS[r.category as LeadershipCategory] ?? r.category}</td>
                <td className={td}>{r.organization}</td>
                <td className={td}>{r.position}</td>
                <td className={`${td} text-right`}>
                  <button onClick={() => handleDelete(r.id)} className="text-xs font-medium text-stone-400 hover:text-red-600">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// --- §G.4: Chapter Account ---------------------------------------------------


export function LeadershipClient({
  members,
  initialChapterAdvisors,
  initialStrategicPlanGoals,
  initialLeadershipPositions,
}: {
  members: Member[];
  initialChapterAdvisors: ChapterAdvisor[];
  initialStrategicPlanGoals: StrategicPlanGoal[];
  initialLeadershipPositions: LeadershipPosition[];
}) {
  return (
    <div className="space-y-4">
      <ChapterAdvisorSection initial={initialChapterAdvisors} />
      <StrategicPlanSection initial={initialStrategicPlanGoals} members={members} />
      <LeadershipPositionSection initial={initialLeadershipPositions} members={members} />
    </div>
  );
}
