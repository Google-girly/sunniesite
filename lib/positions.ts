// Officer positions, straight off the Officer & Active Roster Template.
// Shared across modules rather than owned by Roster: Roster uses it for
// a member's role(s), Budgets uses it for "Chair" — in the chapter's own
// spreadsheets "Chair" is recorded as a position/committee ("Sergeant at
// Arms"), not a typed-in person's name, so it gets the same dropdown.
export const OFFICER_POSITIONS = [
  "President",
  "Vice President",
  "Sergeant-At-Arms",
  "Treasurer",
  "Vice President of Communications",
  "Auditor",
  "Risk Management Officer",
  "Commissioner of Cultura and Sisterhood",
  "Commissioner of Community Service",
  "Commissioner of Fundraising",
  "Commissioner of Alumnae Relations",
  "Commissioner of Social Affairs",
  "Commissioner of Public Relations",
  "Historian",
  "Pledge Mother",
  "University Representative",
  "National Board Representative",
] as const;

export type OfficerPosition = (typeof OFFICER_POSITIONS)[number];
