"use client";

import { useMemo, useState } from "react";
import type { EventReport, Member } from "@/app/generated/prisma/client";
import { EVENT_REPORT_STANDARDS, findStandardOption, standardLabel } from "@/lib/eventReports";
import { parseRoles } from "@/lib/roster";
import { SignaturePad } from "@/components/SignaturePad";
import { confirmDelete } from "@/lib/confirmDelete";

type EventReportWithSigner = EventReport & { signerMember: Member | null };

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error ?? "Something went wrong. Please try again.";
}

const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-burgundy-400 focus:outline-none focus:ring-1 focus:ring-burgundy-400";
const labelClass = "block text-xs font-medium text-stone-600";
const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500";
const td = "px-3 py-2 text-sm";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  standardSection: "",
  eventName: "",
  hostingOrganization: "",
  date: todayIso(),
  lengthOfTime: "",
  location: "",
  membersInAttendance: "",
  purpose: "",
  resourcesUtilized: "",
  signerMemberId: "",
  signerName: "",
  signerTitle: "",
  signedDate: todayIso(),
};

export function EventReportsClient({
  members,
  initialReports,
  viewerId,
  viewerIsPresident,
}: {
  members: Member[];
  initialReports: EventReportWithSigner[];
  /** Who's logged in — only she (as the report's creator) or the President can edit a *finished* report; any draft is fair game for anyone. */
  viewerId: string;
  viewerIsPresident: boolean;
}) {
  // Aug 2026 — "I want other people to be able to edit the drafts of
  // event reports" — matches app/api/event-reports/[id]/route.ts PATCH.
  function canEdit(report: EventReportWithSigner): boolean {
    return report.isDraft || viewerIsPresident || report.createdByMemberId === viewerId;
  }

  const [reports, setReports] = useState(initialReports);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [saveSignature, setSaveSignature] = useState(false);
  const [loadingSignature, setLoadingSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const groups: { section: string; options: typeof EVENT_REPORT_STANDARDS }[] = [];
    for (const option of EVENT_REPORT_STANDARDS) {
      const group = groups.find((g) => g.section === option.section);
      if (group) group.options.push(option);
      else groups.push({ section: option.section, options: [option] });
    }
    return groups;
  }, []);

  const selectedStandard = form.standardSection ? findStandardOption(form.standardSection) : undefined;

  // Aug 2026 — "import answers from past event reports... in the
  // hosting organization and location." Most events repeat (same venue,
  // same hosting org) from one report to the next, so rather than
  // building a whole separate "copy from a past report" picker, every
  // distinct value already on file suggests itself as you type — native
  // <datalist> autocomplete, not a fixed dropdown, so a first-time value
  // still works exactly like free text.
  const pastHostingOrganizations = useMemo(() => {
    const values = reports.map((r) => r.hostingOrganization).filter((v): v is string => Boolean(v?.trim()));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [reports]);
  const pastLocations = useMemo(() => {
    const values = reports.map((r) => r.location).filter((v): v is string => Boolean(v?.trim()));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [reports]);

  // Aug 2026 — "save event forms as drafts for everyone to see." Only
  // these two are required to save a draft (mirrors
  // lib/eventReports.ts parseEventReportInput's isDraft branch) —
  // everything else can come later.
  const draftFilled = Boolean(form.standardSection) && Boolean(form.eventName.trim());

  // Aug 2026: "Make everything in the event report required" — mirrors
  // lib/eventReports.ts parseEventReportInput's required set exactly.
  const requiredFilled =
    Boolean(form.standardSection) &&
    Boolean(form.eventName.trim()) &&
    Boolean(form.hostingOrganization.trim()) &&
    Boolean(form.date) &&
    Boolean(form.lengthOfTime.trim()) &&
    Boolean(form.location.trim()) &&
    form.membersInAttendance.trim() !== "" &&
    Boolean(form.purpose.trim()) &&
    Boolean(form.resourcesUtilized.trim()) &&
    Boolean(form.signerName.trim()) &&
    Boolean(form.signerTitle.trim()) &&
    Boolean(form.signedDate) &&
    Boolean(signatureImage);

  // A member can hold more than one officer position at once (see
  // lib/roster.ts's parseRoles) — Title/Office should print whichever
  // one she's actually signing in as for this report, not every
  // position she holds glued into one string. One position (or none):
  // shown read-only below. More than one: she picks which applies here.
  const signerTitleOptions = useMemo(() => {
    const member = members.find((m) => m.id === form.signerMemberId);
    return parseRoles(member?.role ?? null);
  }, [members, form.signerMemberId]);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSignerMemberChange(memberId: string) {
    update("signerMemberId", memberId);
    if (!memberId) {
      update("signerName", "");
      update("signerTitle", "");
      setSignatureImage(null);
      setSaveSignature(false);
      return;
    }
    const member = members.find((m) => m.id === memberId);
    update("signerName", member?.name ?? "");
    // Default to the first position she holds; if she holds more than
    // one, the Title/Office field below becomes a dropdown so she can
    // pick the one she's signing in as.
    update("signerTitle", parseRoles(member?.role ?? null)[0] ?? "");
    setSaveSignature(false);
    setLoadingSignature(true);
    const res = await fetch(`/api/members/${memberId}/signature`);
    setLoadingSignature(false);
    if (res.ok) {
      const data = await res.json();
      setSignatureImage(data?.imageData ?? null);
    } else {
      setSignatureImage(null);
    }
  }

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSignatureImage(null);
    setSaveSignature(false);
    setError(null);
    setShowAdd(true);
  }

  function startEdit(report: EventReportWithSigner) {
    setEditingId(report.id);
    // Reports saved before Title/Office became position-only may still
    // have every position the signer holds glued into one string —
    // self-heal to just the first of her actual current positions so
    // re-saving without touching the field fixes it rather than keeping
    // the stale joined value around.
    const roles = parseRoles(report.signerMember?.role ?? null);
    const signerTitle =
      report.signerTitle && roles.includes(report.signerTitle) ? report.signerTitle : roles[0] ?? "";
    setForm({
      standardSection: report.standardSection,
      eventName: report.eventName,
      hostingOrganization: report.hostingOrganization ?? "",
      date: report.date,
      lengthOfTime: report.lengthOfTime ?? "",
      location: report.location ?? "",
      membersInAttendance: report.membersInAttendance != null ? String(report.membersInAttendance) : "",
      purpose: report.purpose,
      resourcesUtilized: report.resourcesUtilized ?? "",
      signerMemberId: report.signerMemberId ?? "",
      signerName: report.signerName,
      signerTitle,
      signedDate: report.signedDate ?? todayIso(),
    });
    setSignatureImage(report.signatureImage ?? null);
    setSaveSignature(false);
    setError(null);
    setShowAdd(true);
  }

  function cancelForm() {
    setShowAdd(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSignatureImage(null);
    setSaveSignature(false);
  }

  async function handleSubmit(e: { preventDefault: () => void }, isDraft: boolean = false) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const url = editingId ? `/api/event-reports/${editingId}` : "/api/event-reports";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        standardSection: form.standardSection,
        eventName: form.eventName,
        // Aug 2026 — Save as Draft skips every other field's validation
        // (see lib/eventReports.ts) and just stores whatever's filled in
        // so far; the normal Create/Save button always finalizes
        // (isDraft: false), even when editing a report that started as
        // a draft.
        isDraft,
        hostingOrganization: form.hostingOrganization || undefined,
        date: form.date || undefined,
        lengthOfTime: form.lengthOfTime || undefined,
        location: form.location || undefined,
        membersInAttendance: form.membersInAttendance ? Number(form.membersInAttendance) : undefined,
        purpose: form.purpose || undefined,
        resourcesUtilized: form.resourcesUtilized || undefined,
        signerName: form.signerName || undefined,
        signerTitle: form.signerTitle || undefined,
        signerMemberId: form.signerMemberId || undefined,
        signedDate: form.signedDate || undefined,
        signatureImage: signatureImage || undefined,
      }),
    });
    if (!res.ok) {
      setSaving(false);
      setError(await parseError(res));
      return;
    }
    if (saveSignature && form.signerMemberId && signatureImage) {
      await fetch(`/api/members/${form.signerMemberId}/signature`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: signatureImage }),
      });
    }
    const saved = await res.json();
    setSaving(false);
    setReports((prev) =>
      editingId ? prev.map((r) => (r.id === editingId ? saved : r)) : [saved, ...prev]
    );
    cancelForm();
  }

  async function handleDelete(id: string) {
    if (!confirmDelete("Remove this event report?")) return;
    const res = await fetch(`/api/event-reports/${id}`, { method: "DELETE" });
    if (res.ok) setReports((prev) => prev.filter((r) => r.id !== id));
    else alert(await parseError(res));
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          onClick={() => (showAdd ? cancelForm() : startAdd())}
          className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700"
        >
          {showAdd ? "Cancel" : "New Event Report"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2"
        >
          <p className="sm:col-span-2 text-sm font-semibold text-stone-800">
            {editingId ? "Edit Event Report" : "New Event Report"}
          </p>
          <div className="sm:col-span-2">
            <label className={labelClass}>
              Standard Being Fulfilled (section and sub-section) <span className="text-burgundy-500">*</span>
            </label>
            <select
              value={form.standardSection}
              onChange={(e) => update("standardSection", e.target.value)}
              className={inputClass}
              required
            >
              <option value="">— Select —</option>
              {grouped.map((g) => (
                <optgroup key={g.section} label={g.section}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value} — {o.title} [{o.level}]
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedStandard && (
              <p className="mt-1 text-xs text-stone-500">{selectedStandard.signerHint}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>
              Event Name <span className="text-burgundy-500">*</span>
            </label>
            <input
              value={form.eventName}
              onChange={(e) => update("eventName", e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>
              Hosting Organization <span className="text-burgundy-500">*</span>
            </label>
            <input
              value={form.hostingOrganization}
              onChange={(e) => update("hostingOrganization", e.target.value)}
              className={inputClass}
              list="hosting-organization-options"
              autoComplete="off"
              required
            />
            <datalist id="hosting-organization-options">
              {pastHostingOrganizations.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>
              Location <span className="text-burgundy-500">*</span>
            </label>
            <input
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              className={inputClass}
              list="location-options"
              autoComplete="off"
              required
            />
            <datalist id="location-options">
              {pastLocations.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={labelClass}>
              Date <span className="text-burgundy-500">*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>
              Length of Time <span className="text-burgundy-500">*</span>
            </label>
            <input
              value={form.lengthOfTime}
              onChange={(e) => update("lengthOfTime", e.target.value)}
              placeholder="2 hours"
              className={inputClass}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>
              Number of Members in Attendance <span className="text-burgundy-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={form.membersInAttendance}
              onChange={(e) => update("membersInAttendance", e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>
              Purpose and description of the event <span className="text-burgundy-500">*</span>
            </label>
            <textarea
              value={form.purpose}
              onChange={(e) => update("purpose", e.target.value)}
              rows={3}
              className={inputClass}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>
              Resources utilized in event <span className="text-burgundy-500">*</span>
            </label>
            <textarea
              value={form.resourcesUtilized}
              onChange={(e) => update("resourcesUtilized", e.target.value)}
              rows={2}
              className={inputClass}
              required
            />
          </div>

          <div className="sm:col-span-2 border-t border-stone-100 pt-4">
            <p className="text-sm font-semibold text-stone-800">Signature</p>
            <p className="mt-0.5 text-xs text-stone-500">
              Per Chapter Standards §I.3, wet or digital signatures are required — typed names alone
              aren&apos;t acceptable. Several credits above require a specific signer who isn&apos;t
              necessarily a Chapter officer (see the note under the dropdown once selected).
            </p>
          </div>

          <div>
            <label className={labelClass}>Signer (from Roster)</label>
            <select
              value={form.signerMemberId}
              onChange={(e) => handleSignerMemberChange(e.target.value)}
              className={inputClass}
            >
              <option value="">— Not on Roster / other —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.role ? ` (${m.role})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>
              Signed Date <span className="text-burgundy-500">*</span>
            </label>
            <input
              type="date"
              value={form.signedDate}
              onChange={(e) => update("signedDate", e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>
              Printed Name <span className="text-burgundy-500">*</span>
            </label>
            <input
              value={form.signerName}
              onChange={(e) => update("signerName", e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>
              Title/Office <span className="text-burgundy-500">*</span>
            </label>
            {signerTitleOptions.length > 1 ? (
              // Holds more than one position — pick which she's signing
              // in as, instead of printing every position she holds.
              <select
                value={form.signerTitle}
                onChange={(e) => update("signerTitle", e.target.value)}
                className={inputClass}
              >
                {signerTitleOptions.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            ) : form.signerMemberId && signerTitleOptions.length === 1 ? (
              // Read-only — a Roster member with exactly one position on
              // file: set only from her actual position, not free text,
              // so this can't be filled in with an office she doesn't
              // hold.
              <input value={form.signerTitle} readOnly disabled className={`${inputClass} bg-stone-50 text-stone-500`} />
            ) : (
              // Free text — not on Roster (or on Roster with no
              // position), which several credits explicitly call for
              // (a presenter, a Greek Life advisor, a NALFO officer —
              // see each standard's signerHint above).
              <input
                value={form.signerTitle}
                onChange={(e) => update("signerTitle", e.target.value)}
                placeholder="e.g. Greek Life Advisor"
                className={inputClass}
                required
              />
            )}
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>
              Draw Signature <span className="text-burgundy-500">*</span>{" "}
              {loadingSignature && <span className="text-stone-400">(loading saved signature…)</span>}
            </label>
            <div className="mt-1 max-w-md">
              <SignaturePad value={signatureImage} onChange={setSignatureImage} />
            </div>
            {form.signerMemberId && (
              <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
                <input
                  type="checkbox"
                  checked={saveSignature}
                  onChange={(e) => setSaveSignature(e.target.checked)}
                />
                Save this signature for {form.signerName || "this member"} so it auto-fills next time
              </label>
            )}
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            {error && <p className="mb-2 w-full text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={saving || !requiredFilled}
              className="rounded-md bg-burgundy-600 px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Event Report"}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={saving || !draftFilled}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Save with just the Standard and Event Name filled in — finish the rest later. Visible to everyone, same as a finished report."
            >
              {saving ? "Saving..." : "Save as Draft"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              {["Date", "Event", "Standard", "Signer", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  No event reports yet.
                </td>
              </tr>
            )}
            {reports.map((r) => (
              <tr key={r.id}>
                <td className={`${td} font-medium text-stone-900`}>{r.date || "—"}</td>
                <td className={td}>
                  {r.eventName}
                  {r.isDraft && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      Draft
                    </span>
                  )}
                </td>
                <td className={`${td} text-stone-600`}>{standardLabel(r.standardSection)}</td>
                <td className={`${td} text-stone-600`}>{r.signerName || "—"}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  {r.isDraft ? (
                    <span className="text-sm text-stone-400" title="Finish and save before exporting.">
                      Export
                    </span>
                  ) : (
                    <a
                      href={`/api/event-reports/export/${r.id}`}
                      className="text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                    >
                      Export
                    </a>
                  )}
                  {canEdit(r) && (
                    <button
                      onClick={() => startEdit(r)}
                      className="ml-3 text-sm font-medium text-burgundy-600 hover:text-burgundy-800"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="ml-3 text-sm font-medium text-stone-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
