"use client";

import { useState } from "react";
import type {
  AlphaOrderRecord,
  GpaRecord,
  Member,
  Mentorship,
  ProfessionalDevelopmentAttendee,
  ProfessionalDevelopmentEvent,
} from "@/app/generated/prisma/client";
import { Section, MemberSelect, inputClass, labelClass, th, td, parseFormError as parseError } from "@/components/FormSection";
import { currentTermLabel } from "@/lib/studyHours";
import { confirmDelete } from "@/lib/confirmDelete";
import { MEMBER_STATUSES, MEMBER_STATUS_LABELS, type MemberStatus } from "@/lib/roster";

type GpaRecordWithMember = GpaRecord & { member: Member };
type MentorshipWithMembers = Mentorship & { mentee: Member; mentor: Member };
type AlphaOrderRecordWithMember = AlphaOrderRecord & { member: Member };
type ProfessionalDevelopmentEventWithAttendees = ProfessionalDevelopmentEvent & {
  attendees: (ProfessionalDevelopmentAttendee & { member: Member })[];
};

function GpaSection({ members, initial, term }: { members: Member[]; initial: GpaRecordWithMember[]; term: string }) {
  const [records, setRecords] = useState(initial);
  const [memberId, setMemberId] = useState("");
  const [recordTerm, setRecordTerm] = useState(term);
  const [status, setStatus] = useState("");
  const [termGpa, setTermGpa] = useState("");
  const [cumGpa, setCumGpa] = useState("");
  const [major, setMajor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId || !recordTerm.trim()) {
      setError("Member and term are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/gpa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        term: recordTerm.trim(),
        status: status.trim() || undefined,
        termGpa: termGpa ? parseFloat(termGpa) : null,
        cumGpa: cumGpa ? parseFloat(cumGpa) : null,
        major: major.trim() || undefined,
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
    setStatus("");
    setTermGpa("");
    setCumGpa("");
    setMajor("");
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this GPA record?")) return;
    const res = await fetch(`/api/standards/gpa/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Section B1 — Member Grade Point Averages"
      description="Min. 2.3 term / 2.5 cumulative GPA, reported for Active, Inactive, and Active Alumnae."
    >
      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className={labelClass}>Member *</label>
          <MemberSelect members={members} value={memberId} onChange={setMemberId} />
        </div>
        <div>
          <label className={labelClass}>Term *</label>
          <input value={recordTerm} onChange={(e) => setRecordTerm(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">— Select —</option>
            {MEMBER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MEMBER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Term GPA</label>
          <input
            type="number"
            step="0.01"
            value={termGpa}
            onChange={(e) => setTermGpa(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Cum GPA</label>
          <input
            type="number"
            step="0.01"
            value={cumGpa}
            onChange={(e) => setCumGpa(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Major</label>
          <input value={major} onChange={(e) => setMajor(e.target.value)} className={inputClass} />
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
              {["Term", "Name", "Status", "Term GPA", "Cum GPA", "Major", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-stone-400">
                  No GPA records on file.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.term}</td>
                <td className={td}>{r.member.name}</td>
                <td className={td}>
                  {r.status ? MEMBER_STATUS_LABELS[r.status as MemberStatus] ?? r.status : "—"}
                </td>
                <td className={td}>{r.termGpa ?? "—"}</td>
                <td className={td}>{r.cumGpa ?? "—"}</td>
                <td className={td}>{r.major || "—"}</td>
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

// --- Section B2: Mentorship Program ---------------------------------------


function MentorshipSection({
  members,
  initial,
  term,
}: {
  members: Member[];
  initial: MentorshipWithMembers[];
  term: string;
}) {
  const [records, setRecords] = useState(initial);
  const [menteeId, setMenteeId] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [recordTerm, setRecordTerm] = useState(term);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!menteeId || !mentorId || !recordTerm.trim()) {
      setError("Mentee, mentor, and term are all required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/mentorships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menteeId, mentorId, term: recordTerm.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    setRecords((prev) => [created, ...prev]);
    setMenteeId("");
    setMentorId("");
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this mentorship pairing?")) return;
    const res = await fetch(`/api/standards/mentorships/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Section B2 — Mentorship Program"
      description="Mandatory the term after a member falls below 2.3 term / 2.5 cumulative GPA."
    >
      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Mentee *</label>
          <MemberSelect members={members} value={menteeId} onChange={setMenteeId} />
        </div>
        <div>
          <label className={labelClass}>Mentor *</label>
          <MemberSelect members={members} value={mentorId} onChange={setMentorId} />
        </div>
        <div>
          <label className={labelClass}>Term *</label>
          <input value={recordTerm} onChange={(e) => setRecordTerm(e.target.value)} className={inputClass} />
        </div>
        <div className="col-span-2 sm:col-span-3">
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
              {["Term", "Mentee", "Mentor", ""].map((h) => (
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
                  No mentorship pairings on file.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.term}</td>
                <td className={td}>{r.mentee.name}</td>
                <td className={td}>{r.mentor.name}</td>
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

// --- Section B3: Alpha Order Recipients -----------------------------------


function AlphaOrderSection({
  members,
  initial,
  term,
}: {
  members: Member[];
  initial: AlphaOrderRecordWithMember[];
  term: string;
}) {
  const [records, setRecords] = useState(initial);
  const [memberId, setMemberId] = useState("");
  const [recordTerm, setRecordTerm] = useState(term);
  const [cumGpa, setCumGpa] = useState("");
  const [major, setMajor] = useState("");
  const [isPlaqueRecipient, setIsPlaqueRecipient] = useState(false);
  const [scholarshipAmount, setScholarshipAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const gpa = parseFloat(cumGpa);
    if (!memberId || !recordTerm.trim() || !Number.isFinite(gpa)) {
      setError("Member, term, and a numeric cumulative GPA are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/alpha-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        term: recordTerm.trim(),
        cumGpa: gpa,
        major: major.trim() || undefined,
        isPlaqueRecipient,
        scholarshipAmount: scholarshipAmount ? parseFloat(scholarshipAmount) : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    const member = members.find((m) => m.id === memberId)!;
    setRecords((prev) => [
      { ...created, member },
      ...(isPlaqueRecipient
        ? prev.map((r) => (r.term === recordTerm.trim() ? { ...r, isPlaqueRecipient: false } : r))
        : prev),
    ]);
    setMemberId("");
    setCumGpa("");
    setMajor("");
    setIsPlaqueRecipient(false);
    setScholarshipAmount("");
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this Alpha Order record?")) return;
    const res = await fetch(`/api/standards/alpha-order/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <Section
      title="Section B3 — Alpha Order Recipients"
      description="3.0+ cumulative GPA. One Plaque & SON Scholarship recipient (highest cum GPA) per year."
    >
      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className={labelClass}>Member *</label>
          <MemberSelect members={members} value={memberId} onChange={setMemberId} />
        </div>
        <div>
          <label className={labelClass}>Term *</label>
          <input value={recordTerm} onChange={(e) => setRecordTerm(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Cum GPA *</label>
          <input
            type="number"
            step="0.01"
            value={cumGpa}
            onChange={(e) => setCumGpa(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Major</label>
          <input value={major} onChange={(e) => setMajor(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Scholarship $</label>
          <input
            type="number"
            step="0.01"
            value={scholarshipAmount}
            onChange={(e) => setScholarshipAmount(e.target.value)}
            className={inputClass}
          />
        </div>
        <label className="flex items-end gap-2 pb-1.5 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={isPlaqueRecipient}
            onChange={(e) => setIsPlaqueRecipient(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-400"
          />
          Plaque & Scholarship recipient
        </label>
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
              {["Term", "Name", "Cum GPA", "Major", "Plaque?", "Scholarship", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-stone-400">
                  No Alpha Order records on file.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.term}</td>
                <td className={td}>{r.member.name}</td>
                <td className={td}>{r.cumGpa}</td>
                <td className={td}>{r.major || "—"}</td>
                <td className={td}>{r.isPlaqueRecipient ? "Yes" : "—"}</td>
                <td className={td}>{r.scholarshipAmount != null ? `$${r.scholarshipAmount}` : "—"}</td>
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

// --- Section B5: Professional Development ---------------------------------


function ProfessionalDevelopmentSection({
  members,
  initial,
  term,
}: {
  members: Member[];
  initial: ProfessionalDevelopmentEventWithAttendees[];
  term: string;
}) {
  const [events, setEvents] = useState(initial);
  const [title, setTitle] = useState("");
  const [presentedBy, setPresentedBy] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [recordTerm, setRecordTerm] = useState(term);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingAttendee, setTogglingAttendee] = useState<string | null>(null);

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !recordTerm.trim()) {
      setError("Event/Presentation title and term are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/standards/professional-development", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: recordTerm.trim(),
        title: title.trim(),
        presentedBy: presentedBy.trim() || undefined,
        date: date || undefined,
        time: time || undefined,
        location: location.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await parseError(res));
      return;
    }
    const created = await res.json();
    setEvents((prev) => [created, ...prev]);
    setTitle("");
    setPresentedBy("");
    setDate("");
    setTime("");
    setLocation("");
  }

  async function handleDeleteEvent(id: string) {
    if (!confirmDelete("Remove this event and its attendee list?")) return;
    const res = await fetch(`/api/standards/professional-development/${id}`, { method: "DELETE" });
    if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== id));
    else alert(await parseError(res));
  }

  // One checkbox per Active member instead of a one-at-a-time "pick
  // someone, click Add" dropdown — taking attendance for a whole event
  // means touching most of the roster, and a checklist is a lot fewer
  // clicks for that than repeating a two-step add per person.
  async function toggleAttendee(ev: ProfessionalDevelopmentEventWithAttendees, member: Member, checked: boolean) {
    setTogglingAttendee(member.id);
    if (checked) {
      const res = await fetch(`/api/standards/professional-development/${ev.id}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      setTogglingAttendee(null);
      if (!res.ok) {
        alert(await parseError(res));
        return;
      }
      const created = await res.json();
      setEvents((prev) =>
        prev.map((e) => (e.id === ev.id ? { ...e, attendees: [...e.attendees, created] } : e))
      );
    } else {
      const attendee = ev.attendees.find((a) => a.memberId === member.id);
      if (!attendee) {
        setTogglingAttendee(null);
        return;
      }
      const res = await fetch(`/api/standards/professional-development/attendees/${attendee.id}`, {
        method: "DELETE",
      });
      setTogglingAttendee(null);
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === ev.id ? { ...e, attendees: e.attendees.filter((a) => a.id !== attendee.id) } : e
          )
        );
      } else {
        alert(await parseError(res));
      }
    }
  }

  return (
    <Section
      title="Section B5 — Professional Development"
      description="At minimum 80% of Active members must attend a qualifying event per term; a separate spreadsheet exports per event."
    >
      <form onSubmit={handleAddEvent} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2">
          <label className={labelClass}>Event/Presentation *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Term *</label>
          <input value={recordTerm} onChange={(e) => setRecordTerm(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Presented By</label>
          <input value={presentedBy} onChange={(e) => setPresentedBy(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className={labelClass}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
        </div>
        <div className="col-span-2 sm:col-span-3 lg:col-span-6">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add event"}
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-4">
        {events.length === 0 && <p className="text-sm text-stone-400">No events on file.</p>}
        {events.map((ev) => (
          <div key={ev.id} className="rounded-md border border-stone-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-stone-900">{ev.title}</p>
                <p className="text-xs text-stone-500">
                  {ev.term} · {ev.presentedBy || "—"} · {ev.date || "no date"}
                  {ev.location ? ` · ${ev.location}` : ""}
                </p>
              </div>
              <button
                onClick={() => handleDeleteEvent(ev.id)}
                className="text-xs font-medium text-stone-400 hover:text-red-600"
              >
                Remove event
              </button>
            </div>

            <p className="mt-2 text-xs text-stone-400">{ev.attendees.length} attending</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {members
                .filter((m) => m.status === "ACTIVE" || ev.attendees.some((a) => a.memberId === m.id))
                .map((m) => {
                  const attending = ev.attendees.some((a) => a.memberId === m.id);
                  return (
                    <label key={m.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-700">
                      <input
                        type="checkbox"
                        checked={attending}
                        disabled={togglingAttendee === m.id}
                        onChange={(e) => toggleAttendee(ev, m, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-stone-300 text-rose-600 focus:ring-rose-400"
                      />
                      {m.name}
                    </label>
                  );
                })}
              {members.filter((m) => m.status === "ACTIVE").length === 0 && (
                <p className="text-xs text-stone-400">No Active members on the roster yet.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// --- Section D4: Probation & Suspension -----------------------------------


export function AcademicsClient({
  members,
  initialGpaRecords,
  initialMentorships,
  initialAlphaOrderRecords,
  initialProfessionalDevelopmentEvents,
}: {
  members: Member[];
  initialGpaRecords: GpaRecordWithMember[];
  initialMentorships: MentorshipWithMembers[];
  initialAlphaOrderRecords: AlphaOrderRecordWithMember[];
  initialProfessionalDevelopmentEvents: ProfessionalDevelopmentEventWithAttendees[];
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

      <GpaSection members={members} initial={initialGpaRecords} term={term} />
      <MentorshipSection members={members} initial={initialMentorships} term={term} />
      <AlphaOrderSection members={members} initial={initialAlphaOrderRecords} term={term} />
      <ProfessionalDevelopmentSection
        members={members}
        initial={initialProfessionalDevelopmentEvents}
        term={term}
      />
    </div>
  );
}
