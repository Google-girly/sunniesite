// Every Chapter Standards credit, Sections A-I, in one place — the
// checklist Official Standards Forms became once every credit that
// actually has somewhere to enter data got its own page (Academics,
// Sisterhood, Leadership, Event Reports, Study Hours, Community
// Service, Budgets, Chapter Finances, Fines & Member Accounts). This
// file holds no data-access — the actual "is this done" computation
// lives in the page itself (it needs Prisma), keyed by each item's
// `statusKey`.
//
// `kind`:
//  - "linked": has real backing data somewhere in the app — that data
//    is shown as a hint ("data on file" vs. "no data yet"), but it does
//    NOT auto-mark the item Done. As of Aug 2026 nothing here marks
//    itself complete off of data alone: the officer responsible has to
//    check it off herself (ChecklistOverride) once she's actually
//    confirmed it's ready, same as "manual" below.
//  - "manual": no backing data exists anywhere (a screenshot, an
//    external letter) — the chapter self-attests via a checkbox
//    (ChecklistOverride), with no auto-computed hint to go with it.
//  - "verified": verified directly by the National Board — the chapter
//    submits nothing, so there's no checkbox, just a fixed badge.
export type ChecklistItemKind = "linked" | "manual" | "verified";
export type ChecklistLevel = "Obligatory" | "Required" | "Expected" | "Additional";

export interface ChecklistItem {
  code: string;
  section: string;
  title: string;
  level: ChecklistLevel;
  kind: ChecklistItemKind;
  href?: string;
  statusKey?: string;
  note?: string;
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  // --- A. Campus Recognition ---
  { code: "A.1", section: "Campus Recognition", title: "University Recognition", level: "Required", kind: "manual", note: "Club charter copy, or a letter on Official Letterhead if Greek life isn't recognized." },
  { code: "A.2", section: "Campus Recognition", title: "Council Recognition", level: "Required", kind: "manual", note: "Signed letter from the council advisor (or council president)." },
  { code: "A.3", section: "Campus Recognition", title: "Recognition Workshop", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:A.3" },
  { code: "A.4", section: "Campus Recognition", title: "Chapter Advisor", level: "Required", kind: "linked", href: "/leadership", statusKey: "chapterAdvisor" },

  // --- B. Academics ---
  { code: "B.1", section: "Academics", title: "Grade Reports", level: "Required", kind: "linked", href: "/academics", statusKey: "gpa" },
  { code: "B.2", section: "Academics", title: "Mentorship Program", level: "Required", kind: "linked", href: "/academics", statusKey: "mentorship", note: "Shows \"done\" once a record exists this term — if literally no one qualified, add a note instead." },
  { code: "B.3", section: "Academics", title: "Alpha Order", level: "Required", kind: "linked", href: "/academics", statusKey: "alphaOrder" },
  { code: "B.4", section: "Academics", title: "Study Hours", level: "Required", kind: "linked", href: "/study-hours", statusKey: "studyHoursActive" },
  { code: "B.5", section: "Academics", title: "Professional Development", level: "Expected", kind: "linked", href: "/academics", statusKey: "professionalDevelopment" },
  { code: "B.6", section: "Academics", title: "Inactive Study Hours", level: "Additional", kind: "linked", href: "/study-hours", statusKey: "studyHoursInactive" },

  // --- C. Cultura ---
  { code: "C.1", section: "Cultura", title: "Annual Chapter Event", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:C.1" },
  { code: "C.2", section: "Cultura", title: "Parents' & Families' Banquet", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:C.2" },
  { code: "C.3", section: "Cultura", title: "Community Service (30 hrs/member)", level: "Required", kind: "linked", href: "/community-service", statusKey: "communityService" },
  { code: "C.4", section: "Cultura", title: "Community Service Recognition", level: "Required", kind: "manual", note: "Top service-hours member(s) recognized at a meeting/event — note the date on the Community Service spreadsheet." },
  { code: "C.5", section: "Cultura", title: "Philanthropy", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:C.5" },
  { code: "C.6", section: "Cultura", title: "Community Service Make-Up", level: "Expected", kind: "linked", href: "/community-service", statusKey: "communityServiceMakeUp" },
  { code: "C.7", section: "Cultura", title: "Cultural Engagement Events", level: "Additional", kind: "linked", href: "/event-reports", statusKey: "eventReport:C.7" },

  // --- D. Sisterhood ---
  { code: "D.1", section: "Sisterhood", title: "Battle of the Chapters", level: "Obligatory", kind: "verified", note: "Verified by the National VP of Parliament." },
  { code: "D.2", section: "Sisterhood", title: "Chapter Roster", level: "Required", kind: "verified", href: "/roster", note: "Verified by the National VP of Communications — keep Roster current." },
  { code: "D.3", section: "Sisterhood", title: "Chapter Anniversary Celebration", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:D.3" },
  {
    code: "D.4",
    section: "Sisterhood",
    title: "Probation & Suspension",
    level: "Required",
    kind: "manual",
    href: "/sisterhood",
    note: "Manual, not auto-tracked: zero records usually means nothing to report (the good case), so \"done\" here means the report itself — filed or a signed \"nothing to report\" letter — not \"records exist.\"",
  },
  { code: "D.5", section: "Sisterhood", title: "Substance Abuse Awareness", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:D.5" },
  { code: "D.6", section: "Sisterhood", title: "Sexual Assault Awareness", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:D.6" },
  { code: "D.7", section: "Sisterhood", title: "Chapter Retreat", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:D.7" },
  {
    code: "D.8",
    section: "Sisterhood",
    title: "Chapter Meeting Attendance",
    level: "Expected",
    kind: "linked",
    href: "/sisterhood",
    statusKey: "meetingAttendance",
    note: "The current Chapter Standards PDF's own numbered list has this as D.8; the real submission spreadsheet's tab is still named \"Section D9\" (a drift between National's two documents) — filed under whichever label they currently expect.",
  },
  { code: "D.9", section: "Sisterhood", title: "Sisterhood Social", level: "Expected", kind: "linked", href: "/event-reports", statusKey: "eventReport:D.9" },
  { code: "D.10", section: "Sisterhood", title: "Sister of the Month", level: "Expected", kind: "linked", href: "/sisterhood", statusKey: "sisterOfMonth" },
  { code: "D.11", section: "Sisterhood", title: "CPR & First Aid", level: "Additional", kind: "linked", href: "/sisterhood", statusKey: "certification" },

  // --- E. New Member Education ---
  { code: "E.1", section: "New Member Education", title: "Pledge Mother Contracts", level: "Obligatory", kind: "verified", note: "Verified by the National VP of Undergraduate Affairs." },
  { code: "E.2", section: "New Member Education", title: "New Member Retreat", level: "Obligatory", kind: "verified", note: "Verified by the National VP of Parliament." },
  { code: "E.3", section: "New Member Education", title: "Pledgeship Review Workshop", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:E.3" },
  { code: "E.4", section: "New Member Education", title: "New Pledge Class Induction", level: "Required", kind: "manual", note: "National induction paperwork (Template Library has a blank copy) — no live module tracks this since Pledgeship was removed." },
  { code: "E.5", section: "New Member Education", title: "New Member Initiation", level: "Required", kind: "manual", note: "National initiation paperwork (Template Library has a blank copy) — no live module tracks this since Pledgeship was removed." },
  { code: "E.6", section: "New Member Education", title: "Post Pledgeship Workshops", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:E.6" },

  // --- F. Leadership ---
  { code: "F.1", section: "Leadership", title: "National Council Meetings", level: "Obligatory", kind: "verified", note: "Verified by the National VP of Parliament." },
  { code: "F.2", section: "Leadership", title: "National Conference", level: "Obligatory", kind: "verified", note: "Verified by the National VP of Parliament." },
  { code: "F.3", section: "Leadership", title: "Executive Retreat", level: "Obligatory", kind: "verified", note: "Verified by the National VP of Parliament." },
  { code: "F.4", section: "Leadership", title: "Officer Transition Meetings", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:F.4", note: "Uses an Event Report instead of a dedicated form (Aug 2026)." },
  { code: "F.5", section: "Leadership", title: "Annual Strategic Plan", level: "Required", kind: "linked", href: "/leadership", statusKey: "strategicPlan" },
  { code: "F.6", section: "Leadership", title: "Leadership Position, Greek Related", level: "Additional", kind: "linked", href: "/leadership", statusKey: "leadershipGreek" },
  { code: "F.7", section: "Leadership", title: "Leadership Position, Non-Greek Related", level: "Additional", kind: "linked", href: "/leadership", statusKey: "leadershipNonGreek" },

  // --- G. Finances ---
  { code: "G.1", section: "Finances", title: "Chapter Dues", level: "Obligatory", kind: "verified", note: "Verified by the National VP of Finance." },
  { code: "G.2", section: "Finances", title: "Financial Audit", level: "Obligatory", kind: "manual", href: "/finances", note: "Print out the Financial Books \"Summary\" tab (Export Financial Books on Chapter Finances) once submitted." },
  { code: "G.3", section: "Finances", title: "Member Accounts", level: "Required", kind: "linked", href: "/fines", statusKey: "memberAccounts" },
  // Aug 2026 — "review all of the requirements": G.4 and G.6 were both
  // missing entirely (the real PDF's Section G actually runs G.1-G.6,
  // not G.1-G.3 + G.5 — confirmed against "Chapter Standards Approved
  // 08-2026.pdf").
  { code: "G.4", section: "Finances", title: "Chapter Account", level: "Required", kind: "linked", href: "/finances", statusKey: "chapterAccount", note: "The Chapter's own functioning account (campus or off-campus) — Chapter Finances' fund entries, balance as of June." },
  { code: "G.5", section: "Finances", title: "Budgeting", level: "Required", kind: "linked", href: "/budgets", statusKey: "budgeting" },
  { code: "G.6", section: "Finances", title: "Expense Reports", level: "Required", kind: "manual", href: "/finances", note: "Projected vs. actual expense reports each quarter/semester and for the year, signed by the Treasurer — no dedicated page generates this yet; compile it from Chapter Finances." },

  // --- H. External Relations ---
  { code: "H.1", section: "External Relations", title: "Inter-Chapter Support", level: "Required", kind: "linked", href: "/event-reports", statusKey: "eventReport:H.1" },
  { code: "H.2", section: "External Relations", title: "Alumnae Relations", level: "Expected", kind: "manual", note: "Written updates to alumnae 2+ times/term (email or newsletter) — keep copies." },
  { code: "H.3", section: "External Relations", title: "Alumnae Event", level: "Expected", kind: "linked", href: "/event-reports", statusKey: "eventReport:H.3" },
  { code: "H.4", section: "External Relations", title: "Chapter Website", level: "Expected", kind: "manual", note: "Home page screenshot with the URL visible." },
  { code: "H.5", section: "External Relations", title: "Chapter Branding & Digital Presence", level: "Additional", kind: "manual", note: "Screenshots of qualifying materials." },
  { code: "H.6", section: "External Relations", title: "Inter-Chapter Collaboration", level: "Additional", kind: "linked", href: "/event-reports", statusKey: "eventReport:H.6" },
  { code: "H.7", section: "External Relations", title: "Campus & Greek Organizations Relations", level: "Additional", kind: "linked", href: "/event-reports", statusKey: "eventReport:H.7" },
  { code: "H.8", section: "External Relations", title: "NALFO Day of Service", level: "Additional", kind: "linked", href: "/event-reports", statusKey: "eventReport:H.8" },
  { code: "H.9", section: "External Relations", title: "Yo Soy NALFO Undergraduate Conference", level: "Additional", kind: "linked", href: "/event-reports", statusKey: "eventReport:H.9" },

  // --- I. Administration ---
  { code: "I.1", section: "Administration", title: "Report Submittal (by June 30th)", level: "Obligatory", kind: "manual", note: "The binder itself, submitted to the National VP of Undergraduate Affairs." },
  { code: "I.2", section: "Administration", title: "Report Format", level: "Required", kind: "manual", note: "Every document labeled with its Section/Number and converted to PDF." },
  { code: "I.3", section: "Administration", title: "Signatures", level: "Required", kind: "manual", note: "Wet or digital signatures only — typed names don't count. Event Reports and every Official Letterhead letter in this app already produce a real drawn signature." },
];

export const CHECKLIST_SECTIONS = [...new Set(CHECKLIST_ITEMS.map((i) => i.section))];
