"use client";

import { useEffect, useState } from "react";
import type {
  CertificationRecord,
  Member,
  MeetingAttendanceRecord,
  ProbationRecord,
  SisterOfTheMonth,
} from "@/app/generated/prisma/client";
import {
  CERTIFICATION_TYPE_LABELS,
  CERTIFICATION_TYPES,
  MEETINGS_PER_TERM,
  PROBATION_STATUSES,
  SISTER_OF_MONTH_MONTHS,
  type CertificationType,
  type ProbationStatus,
} from "@/lib/standardsForms";
import { currentTermLabel } from "@/lib/studyHours";
import { Section, MemberSelect, inputClass, labelClass, th, td, parseFormError as parseError } from "@/components/FormSection";
import { confirmDelete } from "@/lib/confirmDelete";

type ProbationRecordWithMember = ProbationRecord & { member: Member };
type CertificationRecordWithMember = CertificationRecord & { member: Member };
type SisterOfTheMonthWithMember = SisterOfTheMonth & { member: Member | null };

interface SisterOfMonthVoteTally {
  open: boolean;
  period: { year: number; month: string } | null;
  results?: { member: { id: string; name: string }; count: number }[];
  totalVotes?: number;
}

function ProbationSection({ members, initial }: { members: Member[]; initial: ProbationRecordWithMember[] }) {
  const [records, setRecords] = useState(initial);
  const [memberId, setMemberId] = useState("");
  const [status, setStatus] = useState<ProbationStatus>("Probation");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [offense, setOffense] = useState("");
  const [sanctions, setSanctions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId) {
      setError("Member is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/probation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        status,
        dateInEffectStart: start || undefined,
        dateInEffectEnd: end || undefined,
        offense: offense.trim() || undefined,
        additionalSanctions: sanctions.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    const member = members.find((m) => m.id === memberId)!;
    setRecords((prev) => [{ ...created, member }, ...prev]);
    setMemberId("");
    setStart("");
    setEnd("");
    setOffense("");
    setSanctions("");
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this record?")) return;
    const res = await fetch(`/api/standards/probation/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Section D4 — Probation & Suspension"
      description="Only formal Chapter judicial-review outcomes — informal warnings don't count."
    >
      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className={labelClass}>Member *</label>
          <MemberSelect members={members} value={memberId} onChange={setMemberId} />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProbationStatus)}
            className={inputClass}
          >
            {PROBATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Effective From</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Effective To</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Offense</label>
          <input value={offense} onChange={(e) => setOffense(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Additional Sanctions</label>
          <input value={sanctions} onChange={(e) => setSanctions(e.target.value)} className={inputClass} />
        </div>
        <div className="col-span-2 sm:col-span-3 lg:col-span-6">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Name", "Status", "Dates In Effect", "Offense", "Additional Sanctions", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-400">
                  No probation/suspension records on file.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.member.name}</td>
                <td className={td}>{r.status}</td>
                <td className={td}>
                  {[r.dateInEffectStart, r.dateInEffectEnd].filter(Boolean).join(" – ") || "—"}
                </td>
                <td className={td}>{r.offense || "—"}</td>
                <td className={td}>{r.additionalSanctions || "—"}</td>
                <td className={`${td} text-right`}>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs font-medium text-stone-400 hover:text-red-600"
                  >
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

// --- Section D9: General Meeting Attendance -------------------------------


function MeetingAttendanceSection({
  initial,
  term,
}: {
  initial: MeetingAttendanceRecord[];
  term: string;
}) {
  const [records, setRecords] = useState(initial);
  const [meetingNumber, setMeetingNumber] = useState("1");
  const [recordTerm, setRecordTerm] = useState(term);
  const [date, setDate] = useState("");
  const [activesAttended, setActivesAttended] = useState("");
  const [quorumMet, setQuorumMet] = useState(false);
  const [officersAttended, setOfficersAttended] = useState("");
  const [otherAttendees, setOtherAttendees] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!recordTerm.trim()) {
      setError("Term is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/meeting-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: recordTerm.trim(),
        meetingNumber: parseInt(meetingNumber, 10),
        date: date || undefined,
        activesAttended: activesAttended ? parseInt(activesAttended, 10) : undefined,
        quorumMet,
        officersAttended: officersAttended ? parseInt(officersAttended, 10) : undefined,
        otherAttendees: otherAttendees.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    setRecords((prev) => [
      created,
      ...prev.filter((r) => !(r.term === created.term && r.meetingNumber === created.meetingNumber)),
    ]);
    setDate("");
    setActivesAttended("");
    setQuorumMet(false);
    setOfficersAttended("");
    setOtherAttendees("");
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this meeting record?")) return;
    const res = await fetch(`/api/standards/meeting-attendance/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Section D9 — General Meeting Attendance"
      description="Quorum is 2/3 of Active membership; up to 10 meetings per term."
    >
      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div>
          <label className={labelClass}>Meeting #</label>
          <select value={meetingNumber} onChange={(e) => setMeetingNumber(e.target.value)} className={inputClass}>
            {Array.from({ length: MEETINGS_PER_TERM }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Term *</label>
          <input value={recordTerm} onChange={(e) => setRecordTerm(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}># Actives Attended</label>
          <input
            type="number"
            value={activesAttended}
            onChange={(e) => setActivesAttended(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}># Officers Attended</label>
          <input
            type="number"
            value={officersAttended}
            onChange={(e) => setOfficersAttended(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Other Attendees</label>
          <input value={otherAttendees} onChange={(e) => setOtherAttendees(e.target.value)} className={inputClass} />
        </div>
        <label className="flex items-end gap-2 pb-1.5 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={quorumMet}
            onChange={(e) => setQuorumMet(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-400"
          />
          Quorum met
        </label>
        <div className="col-span-2 sm:col-span-3 lg:col-span-7">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save meeting"}
          </button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Term", "#", "Date", "Actives", "Quorum?", "Officers", "Others", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-stone-400">
                  No meetings logged.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.term}</td>
                <td className={td}>{r.meetingNumber}</td>
                <td className={td}>{r.date || "—"}</td>
                <td className={td}>{r.activesAttended ?? "—"}</td>
                <td className={td}>{r.quorumMet == null ? "—" : r.quorumMet ? "Yes" : "No"}</td>
                <td className={td}>{r.officersAttended ?? "—"}</td>
                <td className={td}>{r.otherAttendees || "—"}</td>
                <td className={`${td} text-right`}>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs font-medium text-stone-400 hover:text-red-600"
                  >
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

// --- Section D10: Sister of the Month -------------------------------------


function SisterOfMonthSection({
  members,
  initial,
  year,
}: {
  members: Member[];
  initial: SisterOfTheMonthWithMember[];
  year: number;
}) {
  const [records, setRecords] = useState(initial);
  const [month, setMonth] = useState<(typeof SISTER_OF_MONTH_MONTHS)[number]>("September");
  const [recordYear, setRecordYear] = useState(String(year));
  const [memberId, setMemberId] = useState("");
  const [notApplicable, setNotApplicable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ballot, setBallot] = useState<SisterOfMonthVoteTally | null>(null);

  // The live "general consensus" vote tally (see the Dashboard's own
  // ballot card, components/SisterOfMonthBallotCard.tsx, and
  // lib/sisterOfMonthVoting.ts) — read-only here, just to help decide
  // who to actually confirm below.
  useEffect(() => {
    fetch("/api/standards/sister-of-month/vote")
      .then((res) => res.json())
      .then(setBallot)
      .catch(() => setBallot(null));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const y = parseInt(recordYear, 10);
    if (!Number.isFinite(y)) {
      setError("Year is required.");
      return;
    }
    if (!notApplicable && !memberId) {
      setError("Pick a member, or mark the month N/A.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/sister-of-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: y, month, memberId: memberId || undefined, notApplicable }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    setRecords((prev) => [created, ...prev.filter((r) => !(r.year === created.year && r.month === created.month))]);
    setMemberId("");
    setNotApplicable(false);
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this Sister of the Month record?")) return;
    const res = await fetch(`/api/standards/sister-of-month/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section title="Section D10 — Sister of the Month" description="September through June; unmonitored months are marked N/A.">
      {ballot?.period && (
        <div className="mb-4 rounded-md border border-stone-200 bg-stone-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Current Ballot — {ballot.period.month} ({ballot.totalVotes ?? 0} vote
            {(ballot.totalVotes ?? 0) === 1 ? "" : "s"} so far{ballot.open ? "" : ", closed"})
          </p>
          {ballot.results && ballot.results.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-sm text-stone-700">
              {ballot.results.map((r) => (
                <li key={r.member.id}>
                  {r.member.name} — {r.count} vote{r.count === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-stone-400">No votes cast yet.</p>
          )}
        </div>
      )}

      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value as (typeof SISTER_OF_MONTH_MONTHS)[number])}
            className={inputClass}
          >
            {SISTER_OF_MONTH_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Year *</label>
          <input
            type="number"
            value={recordYear}
            onChange={(e) => setRecordYear(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Member</label>
          <MemberSelect members={members} value={memberId} onChange={setMemberId} />
        </div>
        <label className="flex items-end gap-2 pb-1.5 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={notApplicable}
            onChange={(e) => setNotApplicable(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-400"
          />
          N/A (not in session)
        </label>
        <div className="col-span-2 sm:col-span-4">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Year", "Month", "Sister", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-stone-400">
                  No Sister of the Month records on file.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.year}</td>
                <td className={td}>{r.month}</td>
                <td className={td}>{r.notApplicable ? "N/A" : r.member?.name || "—"}</td>
                <td className={`${td} text-right`}>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs font-medium text-stone-400 hover:text-red-600"
                  >
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

// --- Section D11: CPR & First Aid Certification ---------------------------


function CertificationSection({
  members,
  initial,
}: {
  members: Member[];
  initial: CertificationRecordWithMember[];
}) {
  const [records, setRecords] = useState(initial);
  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState<CertificationType>("CPR_AND_FIRST_AID");
  const [issuedDate, setIssuedDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId) {
      setError("Member is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/certifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        type,
        issuedDate: issuedDate || undefined,
        expirationDate: expirationDate || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    const member = members.find((m) => m.id === memberId)!;
    setRecords((prev) => [{ ...created, member }, ...prev]);
    setMemberId("");
    setIssuedDate("");
    setExpirationDate("");
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this certification record?")) return;
    const res = await fetch(`/api/standards/certifications/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Section D11 — CPR & First Aid Certification"
      description="Minimum of 4 certified members required."
    >
      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Member *</label>
          <MemberSelect members={members} value={memberId} onChange={setMemberId} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as CertificationType)} className={inputClass}>
            {CERTIFICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {CERTIFICATION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Issued Date</label>
          <input
            type="date"
            value={issuedDate}
            onChange={(e) => setIssuedDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Expiration Date</label>
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="col-span-2 sm:col-span-4">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200">
          <thead>
            <tr>
              {["Name", "Type", "Issued", "Expires", ""].map((h) => (
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
                  No certification records on file.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.member.name}</td>
                <td className={td}>{CERTIFICATION_TYPE_LABELS[r.type as CertificationType] ?? r.type}</td>
                <td className={td}>{r.issuedDate || "—"}</td>
                <td className={td}>{r.expirationDate || "—"}</td>
                <td className={`${td} text-right`}>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs font-medium text-stone-400 hover:text-red-600"
                  >
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

// --- Top-level -------------------------------------------------------------


export function SisterhoodClient({
  members,
  initialProbationRecords,
  initialMeetingAttendanceRecords,
  initialSisterOfTheMonths,
  initialCertificationRecords,
}: {
  members: Member[];
  initialProbationRecords: ProbationRecordWithMember[];
  initialMeetingAttendanceRecords: MeetingAttendanceRecord[];
  initialSisterOfTheMonths: SisterOfTheMonthWithMember[];
  initialCertificationRecords: CertificationRecordWithMember[];
}) {
  const [term, setTerm] = useState(currentTermLabel());
  const [year, setYear] = useState(new Date().getFullYear());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className={labelClass}>Export Term</label>
            <input value={term} onChange={(e) => setTerm(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Export Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
              className={inputClass}
            />
          </div>
        </div>
        <a
          href={`/api/standards/export?term=${encodeURIComponent(term)}&year=${year}`}
          className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          Export Full Standards Packet
        </a>
      </div>

      <ProbationSection members={members} initial={initialProbationRecords} />
      <MeetingAttendanceSection initial={initialMeetingAttendanceRecords} term={term} />
      <SisterOfMonthSection members={members} initial={initialSisterOfTheMonths} year={year} />
      <CertificationSection members={members} initial={initialCertificationRecords} />
    </div>
  );
}
