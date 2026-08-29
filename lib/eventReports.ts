// Chapter Standards sections that require "the official Event Report
// form" per Chapter Standards Approved 08-2026 — every other credit uses
// a different spreadsheet or an Official Letterhead letter instead (see
// lib/standardsForms.ts for those). This is the "Standard Being
// Fulfilled (section and sub-section)" dropdown on the real form.
//
// signerHint is the exact "who must sign" language from that document —
// worth surfacing, since several of these are explicitly NOT the
// Chapter officer submitting the report (a presenter, a Greek Life
// advisor, a NALFO officer), which is also why EventReport.signerName
// is free text rather than forced to a roster Member.
export type StandardsCreditLevel = "Obligatory" | "Required" | "Expected" | "Additional";

export interface EventReportStandardOption {
  value: string; // "C.1" — matches the Section-and-Number labeling the real submission requires
  section: string; // Chapter Standards section name, e.g. "Cultura"
  title: string; // credit name, e.g. "Annual Chapter Event"
  level: StandardsCreditLevel;
  signerHint: string;
}

export const EVENT_REPORT_STANDARDS: EventReportStandardOption[] = [
  {
    value: "A.3",
    section: "Campus Recognition",
    title: "Recognition Workshop",
    level: "Required",
    signerHint: "Signed by the Greek Life advisor, not a Chapter officer.",
  },
  {
    value: "C.1",
    section: "Cultura",
    title: "Annual Chapter Event",
    level: "Required",
    signerHint: "Signed by the Event Chair. Only one event per academic year counts.",
  },
  {
    value: "C.2",
    section: "Cultura",
    title: "Parents' & Families' Banquet",
    level: "Required",
    signerHint: "Signed by the event Chair.",
  },
  {
    value: "C.5",
    section: "Cultura",
    title: "Philanthropy",
    level: "Required",
    signerHint: "Signed by the Commissioner of Community Service. Note amount raised/donated.",
  },
  {
    value: "C.7",
    section: "Cultura",
    title: "Cultural Engagement Events",
    level: "Additional",
    signerHint: "Signed by the Commissioner of Cultura & Sisterhood. Max 4 events/year.",
  },
  {
    value: "D.3",
    section: "Sisterhood",
    title: "Chapter Anniversary Celebration",
    level: "Required",
    signerHint: "Signed by the event Chair.",
  },
  {
    value: "D.5",
    section: "Sisterhood",
    title: "Substance Abuse Awareness",
    level: "Required",
    signerHint: "Signed by the presenter, not a Chapter officer.",
  },
  {
    value: "D.6",
    section: "Sisterhood",
    title: "Sexual Assault Awareness",
    level: "Required",
    signerHint: "Signed by the presenter, not a Chapter officer.",
  },
  {
    value: "D.7",
    section: "Sisterhood",
    title: "Chapter Retreat",
    level: "Required",
    signerHint: "Signed by the Commissioner of Cultura and Sisterhood. Include retreat minutes/outline separately.",
  },
  {
    value: "D.9",
    section: "Sisterhood",
    title: "Sisterhood Social",
    level: "Expected",
    signerHint: "Signed by the Commissioner of Cultura and Sisterhood.",
  },
  {
    value: "E.3",
    section: "New Member Education",
    title: "Pledgeship Review Workshop",
    level: "Required",
    signerHint: "Signed by the Chapter President.",
  },
  {
    value: "E.6",
    section: "New Member Education",
    title: "Post Pledgeship Workshops",
    level: "Required",
    signerHint: "Signed by at minimum one Pledge Mother.",
  },
  {
    value: "F.4",
    section: "Leadership",
    title: "Officer Transition Meetings",
    level: "Required",
    signerHint: "Signed by the President. One report per outgoing→incoming handoff meeting.",
  },
  {
    value: "H.1",
    section: "External Relations",
    title: "Inter-Chapter Support",
    level: "Required",
    signerHint: "Include a photo with all Chapter members in attendance separately.",
  },
  {
    value: "H.3",
    section: "External Relations",
    title: "Alumnae Event",
    level: "Expected",
    signerHint: "Signed by the Commissioner of Alumnae Relations.",
  },
  {
    value: "H.6",
    section: "External Relations",
    title: "Inter-Chapter Collaboration",
    level: "Additional",
    signerHint: "Signed by the Commissioner of Social Affairs (each participating Chapter signs their own).",
  },
  {
    value: "H.7",
    section: "External Relations",
    title: "Campus & Greek Organizations Relations",
    level: "Additional",
    signerHint: "Signed by the Commissioner of Social Affairs.",
  },
  {
    value: "H.8",
    section: "External Relations",
    title: "NALFO Day of Service",
    level: "Additional",
    signerHint: "Signed by a NALFO Officer.",
  },
  {
    value: "H.9",
    section: "External Relations",
    title: "Yo Soy NALFO Undergraduate Conference",
    level: "Additional",
    signerHint: "Signed by a NALFO Officer.",
  },
];

export function findStandardOption(value: string): EventReportStandardOption | undefined {
  return EVENT_REPORT_STANDARDS.find((s) => s.value === value);
}

export function isEventReportStandard(value: string): boolean {
  return EVENT_REPORT_STANDARDS.some((s) => s.value === value);
}

// "C.1 — Annual Chapter Event" — the exact "section and sub-section"
// plus title, for both the dropdown label and the printed form field.
export function standardLabel(value: string): string {
  const option = findStandardOption(value);
  return option ? `${option.value} — ${option.title}` : value;
}

// Every field is required (Aug 2026) except signerMemberId — the signer
// isn't always someone on Roster (see EVENT_REPORT_STANDARDS
// signerHints, e.g. a Greek Life advisor or presenter).
export interface EventReportInput {
  standardSection: string;
  eventName: string;
  hostingOrganization: string;
  date: string;
  lengthOfTime: string;
  location: string;
  membersInAttendance: number;
  purpose: string;
  resourcesUtilized: string;
  signerName: string;
  signerTitle: string;
  signerMemberId: string | null;
  signedDate: string;
  signatureImage: string;
}

// Shared by create (POST) and edit (PATCH) — same required fields
// either way, so there's exactly one place this validation lives rather
// than two copies drifting apart.
//
// Aug 2026: "Make everything in the event report required" — every
// field on the real form is now required, not just the original five
// (standardSection/eventName/date/purpose/signerName). See
// app/(app)/event-reports/EventReportsClient.tsx for the matching UI
// (required markers + a disabled submit until every field is filled).
export function parseEventReportInput(body: unknown): { data: EventReportInput } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  const standardSection = typeof b.standardSection === "string" ? b.standardSection.trim() : "";
  if (!isEventReportStandard(standardSection)) {
    return { error: "Select which Chapter Standards credit this event report is for." };
  }
  const eventName = typeof b.eventName === "string" ? b.eventName.trim() : "";
  if (!eventName) {
    return { error: "Event name is required." };
  }
  const hostingOrganization = typeof b.hostingOrganization === "string" ? b.hostingOrganization.trim() : "";
  if (!hostingOrganization) {
    return { error: "Hosting Organization is required." };
  }
  const date = typeof b.date === "string" ? b.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "A valid event date is required." };
  }
  const lengthOfTime = typeof b.lengthOfTime === "string" ? b.lengthOfTime.trim() : "";
  if (!lengthOfTime) {
    return { error: "Length of Time is required." };
  }
  const location = typeof b.location === "string" ? b.location.trim() : "";
  if (!location) {
    return { error: "Location is required." };
  }
  const membersInAttendance =
    typeof b.membersInAttendance === "number" && Number.isFinite(b.membersInAttendance)
      ? Math.max(0, Math.trunc(b.membersInAttendance))
      : null;
  if (membersInAttendance === null) {
    return { error: "Number of Members in Attendance is required." };
  }
  const purpose = typeof b.purpose === "string" ? b.purpose.trim() : "";
  if (!purpose) {
    return { error: "Purpose and description of the event is required." };
  }
  const resourcesUtilized = typeof b.resourcesUtilized === "string" ? b.resourcesUtilized.trim() : "";
  if (!resourcesUtilized) {
    return { error: "Resources utilized in event is required." };
  }
  const signerName = typeof b.signerName === "string" ? b.signerName.trim() : "";
  if (!signerName) {
    return { error: "A signer name is required." };
  }
  const signerTitle = typeof b.signerTitle === "string" ? b.signerTitle.trim() : "";
  if (!signerTitle) {
    return { error: "Title/Office is required." };
  }
  const signedDate = typeof b.signedDate === "string" ? b.signedDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(signedDate)) {
    return { error: "A valid Signed Date is required." };
  }
  const signatureImage =
    typeof b.signatureImage === "string" && b.signatureImage.startsWith("data:image/") ? b.signatureImage : "";
  if (!signatureImage) {
    return { error: "A signature is required — per Chapter Standards §I.3, a typed name alone isn't acceptable." };
  }

  return {
    data: {
      standardSection,
      eventName,
      hostingOrganization,
      date,
      lengthOfTime,
      location,
      membersInAttendance,
      purpose,
      resourcesUtilized,
      signerName,
      signerTitle,
      signerMemberId: typeof b.signerMemberId === "string" && b.signerMemberId ? b.signerMemberId : null,
      signedDate,
      signatureImage,
    },
  };
}
