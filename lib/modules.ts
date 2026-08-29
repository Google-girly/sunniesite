// Single source of truth for the sidebar nav + dashboard cards.
//
// To add a new module once it's actually built: flip its `status` to
// "active" here (and add any new modules the same way). See README.md
// for the full step-by-step.

export type ModuleStatus = "active" | "planned";

export interface ModuleDef {
  /** Unique key, also used as the route folder name under app/(app)/. */
  key: string;
  title: string;
  href: string;
  description: string;
  status: ModuleStatus;
}

export const MODULES: ModuleDef[] = [
  {
    key: "calendar",
    title: "Calendar",
    href: "/calendar",
    description: "The chapter's shared Google Calendar — every event in one place.",
    status: "active",
  },
  {
    key: "roster",
    title: "Officer & Active Roster",
    href: "/roster",
    description: "Officers, actives, and their status/crossing term.",
    status: "active",
  },
  {
    key: "budgets",
    title: "Budgets & Reimbursements",
    href: "/budgets",
    description: "Event budgets, line items, and reimbursement totals.",
    status: "active",
  },
  {
    key: "finances",
    title: "Chapter Finances",
    href: "/finances",
    description: "Live rollup of every approved event's Final Budget spend.",
    status: "active",
  },
  {
    key: "fines",
    title: "Fines & Member Accounts",
    href: "/fines",
    description: "Per-member running balance: dues, fines, payments, and fundraising credits.",
    status: "active",
  },
  {
    key: "community-service",
    title: "Community Service",
    href: "/community-service",
    description: "Hour logging, Make-Up tracking, and Chapter Standards reporting.",
    status: "active",
  },
  {
    key: "academics",
    title: "Academics",
    href: "/academics",
    description: "GPA, Mentorship, Alpha Order, and Professional Development — Chapter Standards §B.",
    status: "active",
  },
  {
    key: "sisterhood",
    title: "Sisterhood",
    href: "/sisterhood",
    description: "Probation, Meeting Attendance, Sister of the Month, CPR/First Aid — Chapter Standards §D.",
    status: "active",
  },
  {
    key: "leadership",
    title: "Leadership",
    href: "/leadership",
    description: "Chapter Advisor, Officer Transitions, Strategic Plan, Leadership Positions.",
    status: "active",
  },
  {
    key: "study-hours",
    title: "Study Hours",
    href: "/study-hours",
    description: "Weekly library study hour logging, tracked against Chapter Standards §B.4/§B.6.",
    status: "active",
  },
  {
    key: "meetings-reports",
    title: "Meetings & Reports",
    href: "/meetings-reports",
    description: "Recurring meeting schedule, plus officer reports auto-filled onto minutes.",
    status: "active",
  },
  {
    key: "standards-forms",
    title: "Official Standards Forms",
    href: "/standards-forms",
    description: "Checklist of every Chapter Standards credit — links out to where each one is tracked.",
    status: "active",
  },
  {
    key: "event-reports",
    title: "Event Reports",
    href: "/event-reports",
    description: "Log events against Chapter Standards credits and sign off with a drawn signature.",
    status: "active",
  },
  {
    key: "letters",
    title: "Official Letterhead",
    href: "/letters",
    description: "Generate a letter on the chapter's real letterhead — Letter of Excuse, Active Member Request, or anything else.",
    status: "active",
  },
];
