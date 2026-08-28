"use client";

import { useEffect, useState } from "react";
import type { Member } from "@/app/generated/prisma/client";
import { SignaturePad } from "@/components/SignaturePad";

const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400";
const labelClass = "block text-xs font-medium text-stone-600";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The signer/signature block shared by every Official Letterhead letter
// that requires one (Officer Transitions, Strategic Plan ×2, Chapter
// Account, Expense Reports — see lib/standardsFormsLetters.ts). Backed
// by the shared LetterSignoff model: `section`+`key` identify which
// letter this signature belongs to, so saving here is exactly what the
// letter's own "Export" link picks up — this component never downloads
// anything itself, it just persists the signoff the export route reads.
export function LetterSignoffFields({
  section,
  signoffKey,
  members,
}: {
  section: string;
  signoffKey: string;
  members: Member[];
}) {
  const [signerMemberId, setSignerMemberId] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signedDate, setSignedDate] = useState(todayIso());
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [saveSignature, setSaveSignature] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    // No synchronous setLoaded(false) here on purpose — `loaded` already
    // starts false from useState, and the caller remounts a fresh
    // instance (via `key={signoffKey}`) whenever section/signoffKey
    // changes, so there's never a stale `loaded=true` to reset.
    let cancelled = false;
    fetch(`/api/standards/letter-signoff?section=${encodeURIComponent(section)}&key=${encodeURIComponent(signoffKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setSignerMemberId(data.signerMemberId ?? "");
          setSignerName(data.signerName ?? "");
          setSignerTitle(data.signerTitle ?? "");
          setSignedDate(data.signedDate ?? todayIso());
          setSignatureImage(data.signatureImage ?? null);
        } else {
          setSignerMemberId("");
          setSignerName("");
          setSignerTitle("");
          setSignedDate(todayIso());
          setSignatureImage(null);
        }
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [section, signoffKey]);

  async function handleSignerMemberChange(memberId: string) {
    setSignerMemberId(memberId);
    if (!memberId) return;
    const member = members.find((m) => m.id === memberId);
    setSignerName(member?.name ?? "");
    setSignerTitle(member?.role ?? "");
    setSaveSignature(false);
    const res = await fetch(`/api/members/${memberId}/signature`);
    if (res.ok) {
      const data = await res.json();
      if (data?.imageData) setSignatureImage(data.imageData);
    }
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/standards/letter-signoff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section,
        key: signoffKey,
        signerName,
        signerTitle: signerTitle || undefined,
        signerMemberId: signerMemberId || undefined,
        signedDate: signedDate || undefined,
        signatureImage: signatureImage || undefined,
      }),
    });
    if (saveSignature && signerMemberId && signatureImage) {
      await fetch(`/api/members/${signerMemberId}/signature`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: signatureImage }),
      });
    }
    setSaving(false);
    setStatus(res.ok ? "Signature saved — the Export link will now include it." : "Could not save signature.");
  }

  if (!loaded) return <p className="text-xs text-stone-400">Loading signature…</p>;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={labelClass}>Signer (from Roster)</label>
        <select
          value={signerMemberId}
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
        <label className={labelClass}>Signed Date</label>
        <input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Printed Name</label>
        <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Title/Office</label>
        <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Draw Signature</label>
        <div className="mt-1 max-w-md">
          <SignaturePad value={signatureImage} onChange={setSignatureImage} />
        </div>
        {signerMemberId && (
          <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={saveSignature} onChange={(e) => setSaveSignature(e.target.checked)} />
            Save this signature for {signerName || "this member"} so it auto-fills next time
          </label>
        )}
      </div>
      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !signerName}
          className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Signature"}
        </button>
        {status && <span className="ml-3 text-xs text-stone-500">{status}</span>}
      </div>
    </div>
  );
}
