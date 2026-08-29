# Module Roadmap

Every module we've discussed for the Theta Chapter admin app, and where
things stand. Check items off (and flip their entry in
[`lib/modules.ts`](lib/modules.ts) from `"planned"` to `"active"`) as
they get built. See [README.md](README.md) for how to actually build one.

**App shell**: `app/(app)/layout.tsx`'s outer flex row is `h-screen`
(not `min-h-screen`) — pins it to exactly the viewport height so Sidebar
(`h-full`) and `<main>`'s own `overflow-y-auto` each get an independent
scroll region. A long page (Official Standards Forms, say) scrolls its
own content while the sidebar stays visible, instead of the whole page
scrolling the sidebar out of view.

**Positions & Permissions (Aug 2026)** — replaced the single shared
`APP_PASSWORD` with real per-member accounts, so features could finally
be gated by who's actually logged in rather than everyone sharing one
password. Three pieces:

- **Accounts** (`lib/auth.ts`/`lib/session.ts`): `Member.passwordHash`
  (`scrypt$<salt>$<hash>`, Node's built-in `crypto.scrypt` — no extra
  dependency), a signed session cookie (`HMAC(memberId)` via
  `SESSION_SECRET`, checked at the edge in `proxy.ts` for "is this
  signed at all" and again in `lib/session.ts getCurrentMember()` for
  "does this member still exist" — the latter needs the database, which
  isn't available in `proxy.ts`'s runtime). The President provisions
  every login herself (no email delivery in this app) from **Manage
  Officers & Logins** (`/officers`, President-only, off the sidebar for
  everyone else); each member can change her own afterward from **My
  Account** (`/account`, linked in the sidebar footer). `role` — the
  same comma-separated `OFFICER_POSITIONS` field Roster always had —
  doubles as the source of truth for what a member's logged-in session
  can do; assigning it is now President-only (see below), not editable
  from Roster's own form anymore.
- **Permission framework** (`lib/permissions.ts`): every module gets an
  `AccessPattern` — `"open"` (everyone), `"locked"` (only the owning
  position(s) get in at all — everyone else sees `NotAuthorized`),
  `"self-service"` (everyone can use it for HER OWN records; the owning
  position sees/edits everyone's — Study Hours, Community Service), or
  `"open-submit"` (everyone can create/edit freely — this is the
  "sorority-wide" carve-out the President asked for, e.g. anyone
  submitting a budget for her own event — but specific higher-stakes
  actions are still gated to the owning position per-route, since
  there's no single "creator" field to check generically the way
  self-service modules have `memberId`). President always has full
  access everywhere, on top of whatever's listed. `ownsModule()` is the
  one check used both for "does this locked module let her in" and "can
  she act on someone else's self-service record" — a locked/self-service
  module's "position" list and its "who bypasses row-scoping" list are
  the same list, deliberately, so there's only one place per module that
  says who's in charge of it.
- **Where the line actually falls** (draft — a few of these are genuine
  judgment calls the President should correct if wrong, flagged below):

  | Module | Pattern | Owning position |
  |---|---|---|
  | Study Hours | self-service | Vice President |
  | Community Service (hour log) | self-service | Commissioner of Community Service |
  | Community Service (Make-Up assignment) | owner-only, even for your own | Commissioner of Community Service |
  | Budgets & Reimbursements | open-submit | Treasurer (owns marking a version "Passed") |
  | Event Reports | open | — |
  | Meetings & Reports | open-submit | Vice President of Communications — the chapter's real Secretary-equivalent (confirmed by the President); owns the recurring meeting schedule, deleting a meeting, and exporting the final compiled Minutes. Each Officer Report itself is gated per-report to whichever position it's for, not to this one owner — see below. |
  | Chapter Finances | locked | Treasurer |
  | Fines & Member Accounts | locked | Treasurer |
  | Academics | locked | Vice President ⚠️ no "VP of Academics" exists; reused the general VP position per the President's own answer when this was scoped |
  | Sisterhood | locked | Commissioner of Cultura and Sisterhood |
  | Leadership | locked | President ⚠️ F.6/F.7 Individual Leadership Positions were considered for self-service (each member logging her own outside leadership role) but not built this pass — still fully locked to President for now |
  | Officer & Active Roster | locked | Vice President of Communications (position *assignment* itself is narrower still — see below) |
  | Official Standards Forms | open | — (links out to the modules above, which are each gated on their own) |

  Every locked/self-service module's actual data-entry API routes are
  gated too, not just the page — `requireApiAccess()`/
  `requireModuleOwnerApi()`/`canManageRecord()` in `lib/session.ts` and
  `lib/permissions.ts`, called at the top of every `GET`/`POST`/`PATCH`/
  `DELETE` handler that touches that module's data — since a locked
  page is no real protection if the underlying API is still open to
  anyone who guesses the URL. The read-only multi-module exports
  (`/api/standards/export` covering Academics+Sisterhood at once) are
  the one deliberate exception, protected only by being logged in at
  all rather than owning either specific module — a report dump felt
  lower-stakes than the data entry itself, and cleanly splitting one
  combined export by two different modules' ownership wasn't worth the
  complexity for now.
- **Position assignment is narrower than Roster access**: even though
  Roster itself (name/status/class/nickname/email) is owned by the Vice
  President of Communications, `role` (positions) can ONLY be changed
  from `/api/officers/[id]/role` (President-only) — never through
  Roster's own `PATCH`, even by whoever manages Roster day-to-day. This
  was the actual ask ("make sure I, the President, can assign
  positions") — Roster's edit form displays `role` read-only now with a
  pointer to Manage Officers & Logins instead of a checkbox editor.
  `RoleDropdown` (the multi-select-checkboxes-in-a-dropdown component)
  moved from `RosterClient.tsx` to `OfficersClient.tsx` along with it.
- **Officer Reports are gated per-report, not per-module**: since
  `OfficerReport` is keyed by `position` (a free string matching
  `OFFICER_POSITIONS`), not by `memberId`, submitting one
  (`POST /api/meeting-minutes/reports`) checks
  `parseRoles(viewer.role).includes(position)` directly rather than
  going through `canManageRecord()` (which is `memberId`-keyed, built
  for Study Hours/Community Service) — you can only submit or delete a
  report for a position you actually hold, unless you're the Secretary/
  President. This is genuinely a different shape of self-service than
  the other two, which is why it's its own inline check rather than a
  third case bolted onto `canManageRecord()`.
- **Known gaps, left for later rather than guessed at**: Leadership's
  F.6/F.7 self-service carve-out (noted above). (Roster's "Study Log"/
  "Service Log" cross-links were removed entirely, not just hidden —
  see the second Aug 2026 pass below: Study Hours/Community Service are
  only reachable from their own modules now.)

**Second Aug 2026 pass** — a large batch of fixes/features on top of
the permissions work above, most independent of each other:

- Roster: position assignment aside, general editing (name/status/
  class/etc.) is now President-only too (was Vice President of
  Communications) — narrowed on request. Ordered by Line # (`crossingNumber`,
  nulls last) instead of name, both in `app/(app)/roster/page.tsx`'s
  query and `/api/roster`'s own (missed the API route the first time —
  its `orderBy` still said `name` until a real request against it
  caught it during testing). Study Hours/Community Service's per-member
  "quick log" links removed from Roster entirely — those two modules
  are reachable only through their own pages now, on request.
- **Delete confirmation now requires a password** (`lib/confirmDelete.ts`,
  a `window.prompt` checked against a fixed `"1996"`) — rolled out to
  every destructive action in the app (~20 existing `confirm()` calls
  swapped for `confirmDelete()`, plus 4 in Leadership that had no
  confirmation dialog at all before). Deliberately client-side-only: a
  speed bump against mis-clicks, not real security — the actual access
  control is still `lib/permissions.ts`'s position-based gating on every
  API route, which is what would stop someone who isn't supposed to be
  deleting something in the first place.
- **Event Reports are now editable**, not just create/delete —
  `lib/eventReports.ts parseEventReportInput()` is the validation shared
  between `POST` and the new `PATCH /api/event-reports/[id]`;
  `EventReportsClient.tsx`'s add form doubles as an edit form
  (`editingId` state) rather than being a second copy of it.
- **Event Report / Official Letterhead header overlap, actually fixed**:
  the real cause wasn't the left/right margins from the earlier
  centering fix — it was the TOP margin. `word/header1.xml`'s own
  content (the crest, `behindDoc="1"` floating ~1.72" tall, plus two
  text lines) extends roughly 0.3"-2.0" down the page, well past where
  the old 1" top margin let body text start printing — so the title and
  first field were landing right on top of the crest. `lib/docxLetterhead.ts`
  `sectPr()`'s top margin is now 3312 twips (2.3", computed with buffer
  from the header XML, not visually confirmed — no Word/LibreOffice in
  this environment).
- **Leadership §F.4 (Officer Transition Meetings) removed**, replaced
  by an Event Report — "we can just use an event report for this."
  `OfficerTransition` model, its API routes, `OfficerTransitionSection`,
  and its letter builder are gone; F.4 is now `EVENT_REPORT_STANDARDS`'
  own entry (`lib/eventReports.ts`) and the checklist item points at
  `/event-reports` instead of `/leadership`.
- **§F.5 Strategic Plan gained a `period`** (Year-round/Spring/Fall,
  `lib/standardsForms.ts PLAN_PERIODS`) — the real requirement is one
  annual plan, but the chapter wanted separate per-term plans as an
  option. Filters goals alongside `academicYear`; the letter/signoff
  keys grew a `:period` segment (`${academicYear}:${period}:PLAN`) so
  Spring and Fall plans (and their progress reports) don't share one
  signature.
- **Academics**: §B1's `status` field (a member's roster status *as of
  the start of the term*, per the real form's own instruction — see the
  `GpaRecord` schema comment) is a dropdown of `MEMBER_STATUSES` now
  instead of free text. §B2's Mentee column header was misspelled
  "Menee" — not in this app's own code, but baked into the bundled
  `standards-forms-template.xlsx`'s shared strings; patched the XML
  directly (`<si><t>Menee</t></si>` → `Mentee`), a one-time file fix
  like the earlier Financial Books data-scrub. §B5 Professional
  Development's attendee picker is a checklist of Active members now
  (checkbox per member) instead of a one-at-a-time dropdown-then-Add —
  taking attendance for a whole event touches most of the roster, and a
  checklist is a lot fewer clicks for that.
- **Community Service categorization bug**: the per-member Hour Log
  export already prefixed a Philanthropy entry's event name with "P - "
  so it's auditable from the sheet alone, but the *compiled* Chapter
  Standards §C3/§C4 report — the document actually submitted — never
  had this at all, for either category. Pulled into one shared
  `categorizedEventText()` (`lib/communityService.ts`, now "P -"/"S -"
  for both required sub-minimums, applied in both exports).
- **Budgets queue got a real status dropdown**: `FinancesClient.tsx`'s
  "Awaiting Approval" table showed `status` as a read-only badge and
  only had a one-click "Approve" shortcut — replaced with an inline
  `<select>` of the real `BUDGET_LOG_STATUSES` (Pending/Passed/Failed/
  Tabled, off the actual Financial Books "Budget Log" sheet's own
  vocabulary — not the "Tabled/Approved/Denied" wording as literally
  asked for, since those aren't the real submitted document's terms).
- **Meetings & Reports: schedules are editable and link to their real
  minutes.** `Meeting` gained an optional `scheduleId` back to
  `MeetingSchedule` (previously totally disconnected models). A
  schedule's own new page (`/meetings-reports/[id]`) has the full edit
  form the list page only had a toggle-active/delete for, plus every
  real `Meeting` logged against it with a "+ Log a Meeting" shortcut;
  the general "New Meeting" form on the Minutes list page also grew an
  optional "Part of Series" picker.
- **Sister of the Month became a real monthly vote**, not just an
  officer-entered result — `SisterOfMonthVote` (one row per Active
  member per month, upserted so she can change her mind), tallied live.
  Every Active member gets a ballot card right on the Dashboard
  (`components/SisterOfMonthBallotCard.tsx`) — deliberately NOT inside
  the (locked) Sisterhood module, since the whole point is the general
  membership voting, not one officer. "Auto-opens" is really just "no
  flag to manage" — whatever academic-year month we're in (Sept-June,
  `lib/sisterOfMonthVoting.ts`) IS this month's ballot, and it "closes"
  itself the instant a `SisterOfTheMonth` row exists for that month
  (whoever manages Sisterhood confirms the winner the normal way,
  informed by a live read-only tally now shown right above that form).
  Most-votes-wins; ties aren't auto-broken, the officer decides.
- **Chapter Finances gained a starting balance + fund (income) log** —
  not a second, disconnected ledger: the real Financial Books
  "Checkbook" sheet already has a designated "Starting Balance" row
  (row 9, hand-entered anchor every other row's running-balance formula
  chains off — `CHECKBOOK_FIRST_DATA_ROW`'s own comment already knew
  this) with a blank Balance cell (H9) waiting to be filled, discovered
  by actually reading the real template's XML rather than guessing.
  `ChapterStartingBalance` (one per year) writes straight into H9 on
  export; `ChapterFundEntry` (one per deposit, categorized via
  `lib/financialBooksAccounts.ts INCOME_ACCOUNTS` — the "Revenue" half
  of the real "Accounts" sheet, symmetrical with the expense codes
  already used for Budget line items) is merged with every approved
  Final Budget's expense groups into one chronologically-sorted
  Checkbook ledger (`CheckbookTransaction[]` in
  `lib/financialBooksExport.ts`) instead of "all the expenses, then all
  the deposits."
- Dashboard now filters `MODULES` by `canAccessModule()` the same way
  the Sidebar does — a real gap from the first permissions pass (the
  sidebar was filtered, the dashboard's own card grid wasn't).

- [x] **Officer & Active Roster** — `app/(app)/roster`

- [x] **Officer & Active Roster** — `app/(app)/roster`
      Built in the first pass. Source: `Positions Binders/VP of
      Communications/Officer & Active Roster Template.xlsx`. "Role" is a
      checkbox dropdown (`lib/positions.ts`) — a sister can hold more
      than one position at once, stored as a comma-separated string.
      Also carries Class (Greek letter(s), or "Founding" — free text,
      not a fixed set), Line # (crossing/order number), and Nickname —
      matching the "Class & Crossing Date"/"#"/"Name/Nickname" columns on
      the real Chapter Roster Template, though this app only picked up
      those three fields, not that template's fuller address/education/
      Big-Sister tracking (a bigger, separate thing if it's ever needed).
      Both Community Service and Fines cross-link to a member from here.
- [x] **Budgets & Reimbursements** — `app/(app)/budgets`
      Source: `Templates/Copy of SON Expense Budget.xlsx` (also matches
      `Copy of Meet the Clubs Reimbursement.xlsx`, a filled-in example of
      the same template) — a real workbook with one "Tentative Budget"
      sheet and one "Final Budget" sheet per event, which is exactly the
      three-level shape this module mirrors: a `Budget` (the event —
      name/chair/date/budget #, entered once and shared) has up to two
      `BudgetVersion`s (Tentative and Final, at most one of each — see
      the `@@unique` in `schema.prisma`), each with its own
      `BudgetLineItem` rows, tax rate, notes, and NVP Finance approval
      fields (no income tracking — that section was cut, a budget's Total
      is just Subtotal + Tax now). Budget # is assigned automatically when the event
      is created (`nextBudgetNumber()` in `app/api/budgets/route.ts` —
      one higher than the highest existing one) rather than typed in by
      hand, and can't be edited afterward. Flow: create the event on
      `/budgets`, then create
      its Tentative and/or Final version from the event's overview page
      (`/budgets/[id]`) — each version gets its own page
      (`/budgets/[id]/tentative` or `/final`) with line items, computed
      Subtotal/Tax/Total (matching the sheet's own formulas, not stored)
      — the Final page additionally shows each taxable line item's own
      Tax amount, since that's a real per-item formula on the Final
      Budget sheet (Tentative only ever had one manual lump-sum Tax
      figure, no per-item column, so its table doesn't get one either)
      — the Final page also has "Import from Tentative Budget" (only
      shown when that event has a Tentative Budget with line items on
      it): a checklist of the Tentative's items, each with its own
      checkbox — nothing copies over until you tick some and hit "Import
      Selected," it's not an all-or-nothing bulk copy. Reuses the same
      `POST .../items` route Add Item uses, one request per checked item
      (sequential, not parallel — that route assigns each new item's
      position from the current count, so firing several at once could
      race and hand out the same position twice). Only Final can import
      from Tentative, not the other way.
      Required, app-level (not schema-level — see below): a `Budget`
      needs a Chair and Date of Event, a `BudgetVersion` needs a Sales
      Tax %, and a `BudgetLineItem` needs a Category. All four are
      enforced in both the API routes (400 if blank/missing) and the
      forms themselves (`required` attributes + inline error text before
      the request even goes out) — but deliberately *not* as `NOT NULL`
      columns in `schema.prisma`, so this stays a one-file, no-migration
      change and any pre-existing rows that predate the rule (there were
      a couple, blank Chair/Date, in dev data) aren't left violating a
      constraint. It only affects what you can save going forward. Two
      line items can't share a name within one budget either (case-
      insensitive — "Decorations" and "decorations" collide), checked in
      the same two item routes and surfaced as a 409; this also means an
      Import-from-Tentative checklist pick that would collide with an
      item already on Final gets rejected the same way.
      Each Tentative/Final page also has a "Receipts" section — one per
      store trip/reimbursement, not one per line item (a single receipt
      usually covers several items bought together). The file itself is
      stored as a `Bytes` column on a new `Receipt` model, right in
      `dev.db`, rather than on disk — no `uploads/` folder to create,
      configure, gitignore, or back up separately from the database
      itself, consistent with how this app already avoids anything
      outside the one SQLite file. Images (JPEG/PNG/HEIC/WEBP) and PDFs
      only, 8MB max (`lib/receipts.ts`), enforced in both the upload
      route and the file picker's `accept` attribute. Listing receipts
      (`RECEIPT_SELECT` in `lib/receipts.ts`) never pulls in the actual
      file bytes — those only get fetched, one at a time, when a receipt
      is actually opened, via its own `GET .../receipts/[receiptId]`
      route (`Content-Disposition: inline`, so it previews in a new tab
      instead of forcing a download) — the collapsed NVP Finance
      section, and its own "Export to
      Excel" button — a single-sheet workbook with just that version's
      data. The event's overview page (`/budgets/[id]`) additionally has
      "Export Whole Budget", which fills in *both* the Tentative and
      Final sheets of the same workbook in one download (whichever
      versions actually exist — a version that hasn't been created yet
      just leaves its sheet blank, like the template ships). Both
      exports fill the chapter's actual template
      (`lib/templates/son-expense-budget-template.xlsx`, a copy of
      `Copy of SON Expense Budget.xlsx`, which really does have exactly
      three sheets: INSTRUCTIONS, Tentative Budget, Final Budget) via
      `lib/budgetExport.ts`, which edits the workbook's XML directly
      cell-by-cell (JSZip, not a library that reparses/rewrites the whole
      file — an earlier version did that and it subtly broke borders on
      the merged boxes, see the file's top comment) and strips a stale
      embedded printer reference from the page setup that could otherwise
      make real Excel paginate one page across a 2x2 grid of print pages.
      "Chair" is a dropdown of officer positions (`lib/positions.ts`),
      same list Roster uses for "Role" — the chapter's own budget sheets
      record Chair as a position ("Sergeant at Arms"), not a typed name.
      Date of Event (and Date Due/Submitted/Presented/Rec'd in NVP
      Finance) are real `<input type="date">` pickers now, not free
      text — stored as ISO `YYYY-MM-DD`, displayed locale-formatted via
      `formatEventDate()` in `lib/budgets.ts`. One real limitation: a
      native date input is a single day, so a multi-day event's date
      range (the chapter's own sheets sometimes have one, e.g.
      "09/05/23 - 09/06/23") doesn't fit — picking the start date is the
      workaround until/unless this needs a real range control.
      "Submitted By" pre-fills with whoever currently holds the
      position picked as Chair, cross-referencing the Roster
      (`findRoleHolderNames()` in `lib/roster.ts`, resolved server-side
      in `final/page.tsx`/`tentative/page.tsx` — it only *suggests*, the
      field stays free text and editable if it's wrong or vacant).
      "Date Submitted" defaults to today for the same reason, and "Date
      Due"/"Date Presented" both default to the next scheduled meeting
      (`nextMeetingDate()` in `lib/meetings.ts` — see the Meetings &
      Reports entry below) since chapter policy is a budget is due
      before, and presented at, that meeting — same "just a suggestion,
      still a plain date picker" deal as the other two. A Final
      Budget can't have its Status set to "Passed" with zero line items
      on it — enforced once, server-side, in the version's `PATCH` route,
      since Status gets set from three different places (the NVP form,
      the quick Approve button on `/finances`, and — until just now —
      that page's own edit form). Requiring at least one receipt too was
      asked for but deliberately left off while still being tested — see
      the comment right above the line-item check in that route for
      where to add it.
      On a Final Budget, "Check #" and "Check Amount" also pre-fill —
      Check # with the event's Budget Number (how the chapter
      cross-references a reimbursement check back to the budget that
      generated it) and Check Amount with the Final Budget's computed
      total (`calculateBudgetTotals().total`, rounded) — same
      pre-filled-but-editable/snapshot-at-load deal as Submitted
      By/Date Due, not a locked field, so it won't silently follow along
      if line items change after the page loads. Tentative gets neither
      default (no check has been cut yet at that stage).
      Both the single-version export ("Export to Excel" on a Tentative or
      Final page) and the whole-budget export ("Export Whole Budget" on
      the event overview) write everything that has a cell on the real
      template — header, line items, notes, Motion/Second/Vote,
      Date Due/Rec'd, Check #/Amount, and (Final only) the sales tax rate
      — verified cell-by-cell against a fully filled-out test budget.
      What's *not* on the export: each line item's expense-account
      category, and the Chapter-Budget-Log-only fields (Submitted By,
      Date Submitted, Date Presented, Status, Reimbursement Method) —
      the real template genuinely has no cells for any of these, so by
      design they stay visible in the app but never get printed onto the
      budget document itself. They do get written elsewhere — see Chapter
      Finances' Financial Books export below.
- [x] **Chapter Finances** — `app/(app)/finances`
      Not its own data model — a read-only rollup page that queries every
      `Budget` for a `FINAL`-stage `BudgetVersion` and lists one row per
      event (total spent), plus a chapter-wide total across all of them.
      This *is* the "auto import" from Budgets: because it reads the live
      `BudgetVersion`/`BudgetLineItem` rows directly instead of copying
      them anywhere, there's no import step and nothing can go stale —
      editing a Final Budget on its own page updates this page's numbers
      immediately. An event without a Final Budget yet just doesn't show
      up (counted separately below the table) instead of appearing with
      zeros. Editing happens back in Budgets & Reimbursements, not here —
      "Edit" links to the event's own page (`/budgets/[id]`) and "Open"
      goes straight to its Final Budget; this page is a dashboard over
      that module, deliberately not a second editor for the same data
      (an earlier version *did* let you edit inline here, but that just
      meant two places to keep in sync for no real benefit).
      "Export Financial Books" fills the chapter's actual
      `2025-2026 G.2. Financial Books.xlsx` — specifically its "Budget
      Log" sheet, which already tracks one row per Tentative/Final
      submission and turned out to need only 5 fields
      (`submittedBy`/`dateSubmitted`/`datePresented`/`status`/
      `reimbursementMethod`) that weren't already on `BudgetVersion` —
      those got added to the NVP Finance section of the Final/Tentative
      Budget page. `lib/financialBooksExport.ts` regenerates that sheet
      from scratch on every export (always the same bundled template,
      `lib/templates/financial-books-template.xlsx`), appending one row
      per Final Budget after whichever row is the first genuinely blank
      one — so it's safe to click repeatedly (identical input always
      produces identical rows, never a duplicate) and never disturbs the
      chapter's real hand-entered history already in the sheet. The XML
      surgery helpers this and Budget export both need
      (patchCell/resolveSheetPath/etc.) live in `lib/xlsxPatch.ts` now,
      shared rather than duplicated.
      A Final Budget is "in limbo" (`isApprovedVersion()` in
      `lib/budgets.ts`, just `status === "Passed"`) until someone sets
      its Status — the page has an "Awaiting Approval" queue for exactly
      this, with a one-click Approve action, separate from the "Approved"
      table below it that actually feeds the totals cards and the
      Financial Books export. Nothing else about a limbo budget is
      restricted — it's fully visible and editable everywhere in Budgets,
      it just doesn't count anywhere in Finances yet. (Future direction,
      not built yet: routing the queue into Meetings & Reports' minutes,
      and letting only specific roles — e.g. VP of Communications —
      approve. Both need real per-user accounts first, see
      [Auth](README.md#auth).)
      Each `BudgetLineItem` can also be tagged with an expense category
      code from the chapter's own chart of accounts
      (`lib/financialBooksAccounts.ts`, read off the Financial Books'
      "Accounts" sheet) — this now gets written into the export too (see
      Checkbook below), and one label was drifted/wrong when checked
      against the real sheet (208 is "Food/Club/Party Fundraiser
      **Sales**," fixed).
      "Export Financial Books" also fills the **Checkbook** sheet, not
      just Budget Log — the real workbook's actual per-transaction
      register (Date/Payment Method/Withdraw-or-Deposit/Description/
      **Code**/Debit/Credit/running Balance), which is where a line
      item's expense-account code was always meant to end up (see the
      comment in `lib/financialBooksAccounts.ts`). One row gets written
      per **expense-account code used** in a Final Budget, not one row
      per budget — a real check often covers several categories, and
      Checkbook's own "Code" column only ever holds one code per row, so
      `groupLineItemsByAccountCode()` in `lib/financialBooksExport.ts`
      sums same-code line items (including each item's own share of tax)
      into one row per code; uncategorized items land in one blank-code
      row rather than being silently dropped, so a budget's Checkbook
      rows always add up to its real total. Balance itself is never
      written — every row already carries a pre-existing formula
      chaining off the row above it (same "find the first blank
      pre-styled row, never insert" approach as Budget Log), so Excel
      computes it on open. Verified end-to-end with a 4-item budget split
      across two codes plus one uncategorized item — each group's row and
      the running math were exactly right, and a repeat export produced
      byte-identical rows rather than duplicating anything.
      One more thing found and fixed while building this: the *bundled*
      `lib/templates/financial-books-template.xlsx` turned out to be a
      byte-for-byte copy of the chapter's real, live file — 43 real
      Checkbook transactions and 15 real Budget Log entries (real names,
      real dollar amounts) checked in as if it were a blank form. It's
      now a genuine clean slate: same headers/labels/formulas/styles,
      every real data row cleared out via the same XML-surgery helpers
      the app itself uses (so nothing about the file's structure or
      formatting changed, just the transactional data) — meaning
      "Export Financial Books" now produces a document containing only
      what this app tracks, not a frozen, slowly-staling snapshot of
      whatever the real file looked like on the day the template was
      last saved. Confirmed via a full cell-by-cell diff against the real
      file: 0 differences outside the exact rows meant to be cleared.
      **§G.4/§G.6 removed (Aug 2026)**: `ChapterAccountRecord`/
      `ExpenseReportEntry` and their `ChapterFinanceStandardsSections.tsx`
      UI were built here briefly, then dropped — the chapter's real
      account-balance spreadsheet (this same rollup + Export Financial
      Books' Summary tab above) already covers what those two credits
      needed, so a second, separate place to hand-enter the same balance
      was pure duplicate bookkeeping. The Official Standards Forms
      checklist no longer lists G.4/G.6 at all as a result — see that
      module's entry below.
- [x] **Fines & Member Accounts** — `app/(app)/fines`
      Built as a full per-member ledger, not a standalone fines log — the
      chapter asked for this explicitly, and it turns out the governing
      docs already require it: Chapter Standards §G.3 has the Treasurer
      keep "accurate and up to date records of each member's account.
      Dues, fines and payments are clearly noted," and Chapter Bylaws
      Article XIII §C requires a monthly Member Account Balance Statement.
      One new model, `AccountEntry` (belongs to a `Member`, cascade-
      deletes with it): `type` is `DUES` | `FINE` | `PAYMENT` | `CREDIT`
      (plain string, same reasoning as `Member.status`/`BudgetVersion.stage`
      — SQLite has no enum type), `amount` is always stored positive, and
      which way it moves the balance is derived from `type` rather than
      the sign (`isChargeType()` in `lib/fines.ts`) — Dues/Fine charge,
      Payment/Credit pay down. `calculateBalance()` just sums that.
      `lib/fines.ts` also holds `FINE_SCHEDULE` — the actual dollar
      amounts from Chapter Standing Rules Article VII (Meetings,
      Activities/Events, Payment of Dues, Checks, Missed Deadlines),
      confirmed with the chapter before building since Standing Rules and
      Bylaws disagree on one line (bounced checks: Bylaws' flat $10 is
      what's enforced, not Standing Rules' "$25 or the bank's fee"). The
      Add Entry form's Type dropdown picks the shape of the rest of the
      form; picking "Fine" adds a second dropdown of the schedule grouped
      by category (`groupFinesByCategory()`) that pre-fills description
      and amount — both stay editable after, same "pre-filled, not
      locked" pattern as Budgets' Submitted By/Date Due. Credit exists
      specifically for Standing Rules Article X's fundraising-surplus
      credit (a member who raises more than the fundraiser's minimum gets
      40% of the excess credited to her account) — nothing enforces the
      40% math automatically, it's just a place that credit lands once
      someone's worked it out. `/fines` is the roster-wide list (name,
      role, status, a colored balance pill); `/fines/[id]` is one
      member's full ledger with add/edit/delete, cross-linked from both
      the main list and a new "Account" link on the Roster page. No
      export yet (the Bylaws-required monthly statement is just this
      page's table right now, not a generated document) — natural next
      step whenever that's asked for.
- [ ] ~~Pledgeship~~ — removed (Aug 2026). Lived at `app/(app)/pledgeship`,
      covering `PledgeClass`/`Pledge`/`PledgeProgressReport`/
      `PledgeServiceHourEntry` and two exports filling the real
      "Pledgeship Forms Rev. Winter_Spring 2026.xlsx." Removed at the
      chapter's request — the module, its API routes, and all four
      backing tables are gone, including the one real `PledgeClass` row
      that existed ("Psi," Fall 2026). Section E's New Pledge Class
      Induction (§E.4) and New Member Initiation (§E.5) credits are now
      self-attested manual checkboxes on Official Standards Forms
      instead of auto-tracked; the blank "Pledgeship Forms" template is
      still downloadable from the Template Library, just with no live
      module behind it anymore.
- [x] **Community Service** — `app/(app)/community-service`
      Two source documents, both actually used: `Community Service Hours
      (Spring 2022).xlsx` (per-member hour logs — its first tab,
      "EXAMPLE," is the never-filled-in template; the other 13 tabs are
      real 2021/22 member sheets, not touched) and `Community Service
      Chapter Standard Forms - Approved 8.2026.xlsx` (the compiled report
      actually submitted to Nationals — Sections C3/C4 and C6, genuinely
      blank throughout, unlike the Hours workbook). One new model per
      real-world concept: `ServiceHourEntry` (one logged volunteer event
      — Date/Event/Description/Hours/Volunteer Contact, matching the real
      template's columns) and `MakeUpProject` (Section C6 — a member
      placed on Community Service Make-Up for falling short a term,
      Chapter Standing Rules Article VIII §B). `ServiceHourEntry` also
      carries `category` (Philanthropy/Survivor Support/General) even
      though the real template has no such column — it's there because
      the actual *requirement* it's tracking does have that split
      (Article IX: 30 hrs/year, ≥10 Philanthropy, ≥10 survivor-support),
      so the app can show real progress against both sub-minimums, not
      just a bare total.
      `/community-service` lists every member whose status is exactly
      Active or Inactive (not Special Circumstance or Alumnae — worth
      revisiting if that's too narrow) with progress bars against all
      three thresholds, plus a "Log Hours" quick-add right there — pick
      who it's for from a dropdown, no need to open her individual page
      just to log one entry — that list updates its totals immediately,
      not just on next page load. `/community-service/[id]` is still
      where the full log/edit/delete and Make-Up Projects live. Roster
      also links here directly ("Service Log"), same as it does to Fines.
      Two exports, `lib/communityServiceExport.ts`: "Export Hour Logs"
      clones the real EXAMPLE sheet once per Active/Inactive member (one
      tab per sister, named for her, alongside the original blank EXAMPLE
      tab) and fills it from her `ServiceHourEntry` rows — genuinely
      different from every other export in this app, since Budget/
      Financial Books only ever edit cells on a sheet that already
      exists; this one has to create the sheet itself first (new
      `<sheet>`/relationship/Content_Types entries, not just cell edits).
      That template turned out to only have real, styled cells through
      row 22 — nowhere near Budget Log/Checkbook's hundreds of spare
      rows — and rows 21-22 of *those* aren't even log rows, they're a
      merged notes/signature block; `logRowForIndex()` places the first 9
      entries in rows 12-20, then jumps to row 23+ for the rest,
      synthesizing real cells there as needed (`ensureLogRowCells()`) so
      a long log never gets silently truncated. Also found and fixed
      along the way: the template's own Hours column (E) carries a
      leftover *date* number format on rows 13-20, which would otherwise
      render "2.5" as a garbled date — forced to a known-good style
      before every write. "Export Chapter Standards Report" fills the
      real Section C3/C4 (every Active/Inactive member's log, several per
      sheet, 3 data rows each — a real limit of the official form itself,
      so more than 3 logged events only shows the first 3, chronologically,
      with the true grand total still in the Total column) and Section C6
      (only members who currently have a `MakeUpProject` on file). Both
      exports use `p - ` as an Event prefix for Philanthropy-category
      entries, matching the "p=Philanthropy" legend already printed on
      the real template rather than inventing new labeling.
      One shared bug found and fixed while building this:
      `resolveSheetPath()` (used by every export in this app) didn't
      XML-escape a sheet name before searching for it, so "Section C3 &
      C4" — stored in the file as "...C3 &amp; C4" — never matched.
      Harmless before now since no other sheet name in this app contains
      an XML-special character, but real for this one.
- [x] **Study Hours** — `app/(app)/study-hours`
      Source: a real member's personally-filled Library Study Hours
      sheet rather than a blank template (unlike Community Service's
      EXAMPLE tab), so the bundled
      `lib/templates/study-hours-template.xlsx` had her actual name and
      log entries stripped out before being checked in. One model,
      `StudyHourEntry` (Study Location/Date/Time In/Time Out/Hours,
      matching the real sheet's columns) — deliberately *not* one row
      per week; Chapter Standards §B.4/§B.6 require 6 hours/week, 80% of
      weeks completed per term, so the weekly rollup is computed
      (`lib/studyHours.ts calculateWeeklyCompletion()`) from whatever
      individual sessions get logged, not entered directly. There's no
      `Term` model in this app (Community Service doesn't have one
      either) — `currentTermRange()` guesses Spring/Summer/Fall date
      boundaries from today's date the same way `currentTerm()` already
      does for Community Service, and the two Chapter Standards exports
      below take explicit `term`/`start`/`end` query params to override
      that guess with the real submission period.
      `/study-hours` mirrors Community Service's list page exactly,
      right down to the inline "Log Hours" quick-add. `/study-hours/[id]`
      is the full per-member log.
      **Week of the month, auto-calculated (Aug 2026)**: nobody types a
      week number anywhere — `weekOfMonth()` in `lib/studyHours.ts` just
      takes an entry's own date and does `Math.ceil(day / 7)` (1st-7th =
      Week 1, 8th-14th = Week 2, ...), shown as a live hint next to the
      Date field while logging and as its own column in the per-member
      log table. Purely a display convenience — it doesn't change how
      entries are stored, matched to a template row on export, or rolled
      up into weekly completion (that's still `calculateWeeklyCompletion()`'s
      own Monday-anchored ISO weeks, a different and unrelated notion of
      "week" used only for the §B.4/§B.6 80%-of-weeks math).
      Two exports, `lib/studyHoursExport.ts`: "Export Hour Logs" clones
      the real template's single sheet once per Active/Inactive member,
      same sheet-cloning approach as Community Service (now shared,
      `lib/xlsxSheetClone.ts`). That template turned out to have only 22
      real pre-styled data rows for the whole term — split across
      Jan/Feb/Mar/Apr/May month blocks of uneven size (4/6/7/3/2 rows) —
      a real limit of the physical form, not a bug; entries are filled
      into those 22 slots in date order regardless of which month-header
      happens to sit above a given row (the row's own date cell is what
      actually matters), and a member who logs more than 22 sessions in
      one term spills into a "(cont.)" sheet immediately after hers
      rather than being silently truncated. "Export Chapter Standards
      Report" fills Sections B4 (Active) and B6 (Inactive) of the shared
      Chapter Standards template (see Official Standards Forms below)
      with each member's weeks-in-term/weeks-completed/percentage —
      dropping the template's other 10 sections from the output
      (`removeSheet()`, the inverse of `addClonedSheet()`) so this export
      doesn't ship 10 blank tabs someone could mistake for "nothing
      logged."
- [x] **Meetings & Reports** — `app/(app)/meetings-reports` (partial)
      The meeting *schedule* (`MeetingSchedule` — a recurring rule like
      "every other Sunday," not a list of one-off dates; the actual
      upcoming dates are computed from it, see `lib/meetings.ts`) feeds
      Budgets' "Date Due"/"Date Presented" suggestions. Agendas and event
      reports are still to come — source, once built: `Templates/Agenda
      XX_XX_XXXX.docx`, `Templates/Copy of Event Report .docx`,
      `Templates/Plegegship Meeting Event Report .docx`.
      **Meeting Minutes** (`/meetings-reports/minutes`) is built: officers
      submit their reports for a specific `Meeting` (one real date —
      distinct from `MeetingSchedule`'s recurring rule), and "Export
      Minutes" fills them onto the real `Minutes Template.docx` (root of
      the Drive — there's a second, fancier template under `Positions
      Binders/VP of Communications/Meeting Minutes/` with attendance/
      quorum tracking; this one is the one actually in use, per your
      call). This is the app's first **.docx** export — every prior
      export has been .xlsx, and WordprocessingML's structure (paragraphs
      `<w:p>` containing runs `<w:r>` containing text `<w:t>`) is
      different enough from SpreadsheetML that it got its own small
      surgical-edit library, `lib/docxPatch.ts`. Two models: `Meeting`
      (date/time) and `OfficerReport` (one per meeting per position,
      upserted on `(meetingId, position)` so resubmitting replaces a
      draft rather than duplicating). Scope deliberately stops at officer
      reports — per your call, Roll Call, Approval of Minutes/Agenda,
      Business, Old Business, Announcements, and Adjournment all stay as
      the template's own blank fields, filled in by hand same as today.
      This template's real quirk, and the reason `lib/docxPatch.ts` ended
      up with three helpers instead of one: every officer heading
      ("President ()") isn't one run — it's a label run ("President ")
      immediately followed by a separately-colored, empty "()" run, and
      "()" alone isn't unique in the document (all 16 headings have one),
      so it can't be searched for directly. `fillEmptyParensAfter()`
      scopes its search for "()" to *within* a specific label's own
      paragraph before filling in the current holder(s) from Roster
      (`findRoleHolderNames()`, the same lookup Budgets already uses for
      "Chair"). `insertParagraphsAfter()` (reused as-is) drops each
      submitted report in as a new list item one level deeper, right
      after that heading — this template's own `numbering.xml` already
      defines that deeper level as a plain numbered sub-list, so it
      renders nested under the heading it belongs to rather than
      introducing new formatting. A position with no report on file still
      gets a line ("No report submitted.") so gaps are visible rather
      than silently blank. `insertRunAfterLabel()` handles a third case —
      "Date: " and "Meeting Call to Order: " have *nothing* after the
      label at all, not even an empty run to overwrite, so filling those
      in means adding a whole new run rather than editing one.
      The export also fills the **Active Roster** table — its own header
      ("Active Roster Fall 2023") gets replaced with the term the
      *meeting's own date* falls in (`currentTerm()`, reused from
      lib/communityService.ts — same Spring/Summer/Fall guess, not tied to
      today's date so exporting an old meeting still shows the term it
      actually happened in). Its 4 rows are each Name | Email, so only
      every other empty cell (the Name column) gets filled with current
      Active members, alphabetically, up to a real 4-member capacity per
      export — `fillTableCellsAfterHeader()` grew a `stride` parameter for
      this (stride=2 fills cell 0, skips cell 1, fills cell 2, ...) so the
      Email column is left blank rather than getting the next name by
      mistake. Its cells hit a fourth pattern to begin with: empty runs
      with nothing to distinguish one from another, so they can only be
      targeted by *position* (the Nth empty cell after the header).
      Email is deliberately left blank for now (`Member.email` already
      exists in the schema; the column just isn't filled yet) pending a
      decision on whether/how to surface it here.
      "Meeting Call to Order" now defaults to whatever `MeetingSchedule`
      already has established (`nextOccurrence()` + a new
      `formatTime12h()`, reusing the same schedule math Budgets' "Date
      Due" suggestion already relies on) when creating a new Meeting, so
      the common case doesn't require typing the date/time in by hand —
      still fully editable.
      The Officer Information table (real chapter Gmail addresses per
      position, each one an actual `mailto:` hyperlink, not just colored
      text) had 7 stale emails and one missing row (Risk Management
      wasn't listed at all) — cross-checked against `Accounts And
      Passwords.docx` and fixed directly in the bundled template (a
      one-time correction, not something the export recomputes — these
      don't change per meeting). Every hyperlink's underlying relationship
      target needed fixing too, not just its visible text, or the link
      text and where it actually goes would've silently disagreed.
      Inserting the new Risk Management row hit a real, easy-to-miss
      OOXML pitfall: the next `rId` number looked free by scanning
      hyperlink relationships alone, but was already claimed by the
      document's footer reference — cross-referencing *all* relationship
      types (not just hyperlinks) before picking a new one avoided a
      silent duplicate-ID conflict. Passwords from that same source
      document were deliberately never used anywhere in the app or this
      template — only the emails were worth cross-checking.
      Also populated Roster with the chapter's actual current officers
      (previously just one member on file) so these fields have real
      names to fill in instead of staying blank — sourced from the
      filled-in example found in the other Minutes template while
      scoping this feature.
- [x] **Official Standards Forms** — `app/(app)/standards-forms`
      **Reorganized Aug 2026** from a data-entry page into a pure
      checklist — the user's own framing: "a place where all of our
      requirements are stored and a checklist as opposed to us filling
      them out there," with data entry "delegated into other parts of
      the website." Every Chapter Standards credit that had somewhere
      real to live got its own page (Academics, Sisterhood, Leadership —
      all new, see below — plus the existing Event Reports/Study
      Hours/Community Service/Budgets/Chapter Finances/Fines/Roster);
      this page now just reads that data back.
      `lib/chapterStandardsChecklist.ts` is the full list — all ~59
      credits, Sections A through I, not just the subset this app
      tracks — each with a `kind`: `"linked"` (real backing data exists
      somewhere in the app), `"manual"` (no backing data exists anywhere
      — a screenshot, an external letter), or `"verified"` (verified
      directly by the National Board; the chapter submits nothing, so
      it's always shown done with no checkbox).
      **"Done" requires an explicit checkbox, always (Aug 2026)** — the
      user's own framing: "don't mark it as done unless the officer
      assigned marks it as done." A `"linked"` item's real data is shown
      as a hint badge ("Data on file" / "No data yet," from `page.tsx`'s
      batched `Promise.all` of counts/existence checks per `statusKey`,
      including one `eventReport.groupBy(standardSection)` covering all
      ~18 Event-Report-backed credits in a single query) but never flips
      the item to Done by itself — only checking `ChecklistOverride`'s
      box does that, same as `"manual"` items always required. There's
      no per-user login to actually enforce *who* checks a box (see
      [Auth](README.md#auth)) — "the officer assigned" is a
      responsibility convention the chapter enforces themselves, not
      something the app restricts.
      A few items are `"manual"` specifically because an *empty* table
      is the good/compliant state, not the incomplete one — §D.4
      Probation & Suspension being the clear example (zero probation
      records usually means nothing to report, not "not done yet") —
      though since Aug 2026 every non-verified item is self-attested
      the same way regardless of `kind` (see above), so this distinction
      now only matters for whether a data hint is shown at all, not for
      how "Done" gets set.
      **Sections collapse by default (Aug 2026)** — `Section` in
      `components/FormSection.tsx` now opens closed instead of open, so
      a page with several of these (this one especially, one per Chapter
      Standards section) stays compact until you click into the one you
      need. Applies everywhere `Section` is used, not just here.
      **Template Library** (top of the page, `components/TemplateLibrarySection.tsx`,
      unchanged by the reorg) — a read-only index over every blank
      template in `lib/templates/`, `lib/templateLibrary.ts` the single
      list. `/api/templates/[key]` serves the raw file straight off disk
      with no data filled in, distinct from every module's own "Export."
      Each row's title is itself the link over to that template's live
      section; the download-blank link is the only thing on the right.
- [x] **Academics** — `app/(app)/academics`
      Chapter Standards §B credits with no other home: B1 (Member GPAs),
      B2 (Mentorship Program), B3 (Alpha Order), B5 (Professional
      Development). §B.4/§B.6 are Study Hours' own page. Split out of
      the old single "Official Standards Forms" page once that page
      became a checklist (see above) — the actual add-form + table UI
      for these four sections is unchanged, just relocated.
      Source: found the *current* master template only after the older
      `Templates/Copy of 2021-2022 Chapter Standard Forms.xlsx` turned
      out to be superseded — the real one is `Chapter Standard Forms -
      Approved 8.2026.xlsx`. Field definitions and point values
      cross-checked against `Chapter Standards Approved 08-2026.pdf`.
      One model per section: `GpaRecord`, `Mentorship`,
      `AlphaOrderRecord`, `ProfessionalDevelopmentEvent` +
      `ProfessionalDevelopmentAttendee` — see `lib/standardsForms.ts` for
      the thresholds each is grounded in (2.3 term/2.5 cum GPA, 3.0 for
      Alpha Order, etc). Add + delete only, no per-row inline edit.
      Export (`lib/standardsFormsExport.ts`, still shared with
      Sisterhood below — one workbook, `/api/standards/export`) fills
      B1/B2/B3/B5 directly onto the master template's existing sheets —
      a header row followed by exactly 21 pre-styled data rows,
      verified against B1's own `=average(D16:D36)` formula range. A
      section with more than 21 records in a term hits a real limit of
      the official form itself. B5 is the one exception — the real form
      only fits one event per sheet ("a separate spreadsheet must be
      submitted for each event attended"), so each Professional
      Development event in scope clones a fresh copy of the B5 sheet.
- [x] **Sisterhood** — `app/(app)/sisterhood`
      Chapter Standards §D credits with no other home: D4 (Probation &
      Suspension), D9/D8 (General Meeting Attendance — see the numbering
      note below), D10 (Sister of the Month), D11 (CPR & First Aid
      Certification). D1/D2 are verified directly by National; D3 and
      D5-D7/D9(social) export from Event Reports instead. Split out of
      the old single Standards Forms page, same as Academics.
      Meeting Attendance and Sister of the Month both upsert on a
      natural key (`term`+`meetingNumber`, `year`+`month`) rather than
      accumulating duplicate rows. Export shares the same
      `lib/standardsFormsExport.ts`/`/api/standards/export` workbook as
      Academics.
      **D8 vs D9 numbering**: the *current* `Chapter Standards Approved
      08-2026.pdf`'s own numbered list has Chapter Meeting Attendance as
      item #8 in Section D (Sisterhood Social is #9) — seemingly
      contradicting this app's "§D.9" labeling for Meeting Attendance.
      Checked against the real submission artifact instead of the
      descriptive PDF: `standards-forms-template.xlsx`'s own sheet is
      literally named "Section D9" for Meeting Attendance — that's what
      actually gets filed. This means National's own two documents
      disagree with each other (the PDF's prose numbering vs. the
      spreadsheet's tab name), not that this app has a bug — kept the
      existing D9 label here since it matches the artifact that's
      actually submitted, but the checklist (above) labels this credit
      "D.8" to match the current descriptive PDF, with a note explaining
      the discrepancy, since a *new* label had to be picked for the
      checklist and the PDF is more likely to reflect any future
      correction than a legacy spreadsheet tab name.
- [x] **Leadership** — `app/(app)/leadership`
      Chapter Standards credits about chapter governance with no other
      home: A.4 (Chapter Advisor), F.4 (Officer Transition Meetings),
      F.5 (Annual Strategic Plan / Progress Report), F.6/F.7 (Individual
      Leadership Positions). Split out of the old single Standards Forms
      page, same as Academics/Sisterhood.
      - **A.4 Chapter Advisor** — name/title/email/phone/office address.
      - **F.4 Officer Transition Meetings** — one row per outgoing→
        incoming officer handoff for an academic year (position dropdown
        reuses `OFFICER_POSITIONS`), signed by the President.
      - **F.5 Annual Strategic Plan** — one `StrategicPlanGoal` per
        priority; the *same* rows back both the Plan (due 9/15) and its
        Progress Report (due 1/31) rather than being two models, since
        the real requirement is updating the same plan's progress, not
        writing a second document. Status/progress notes are edited in
        place via `PATCH` (this page's one exception to add/delete-only —
        the whole point of a Progress Report is updating existing goals).
      - **F.6/F.7 Individual Leadership Positions** — one `category`
        field (`GREEK`/`NON_GREEK`) splits what's otherwise identically-
        shaped data, since they're separate credits/point caps.
      None of these have a designated national spreadsheet the way
      B1-B6/C3-C6/D4/D9-D11 do — Chapter Standards §I.2 states the
      fallback directly: "All credits that do not have a designated
      spreadsheet, form or format are submitted on Official Letterhead."
      So all of these export as letters through one generic builder,
      `buildLetterheadDocx()` in `lib/docxLetterhead.ts` — the paragraph/
      signature primitives originally built for `lib/eventReportExport.ts`
      (fieldParagraph/twoFieldParagraph/signature-embedding/etc.) got
      pulled out into that shared module once a second export needed the
      exact same pieces; `eventReportExport.ts` was refactored to import
      from it too rather than keeping two copies. The letterhead itself
      (crest + fonts + header) is the same physical asset as Event
      Report's — `lib/templates/event-report-template.docx` is reused
      as-is rather than duplicated as a second ~580KB binary, since only
      its header/fonts/rels/theme/styles ever get read, never its
      original body.
      **Shared signatures for these letters**: rather than a signature
      per data row (each letter aggregates many rows into one document,
      re-exported as data changes), one `LetterSignoff` model covers
      every section that needs a signature (F.4, F.5 ×2 variants) —
      `section`+`key` identify which letter (an academic year, or a
      `year:variant` pair for F.5) — saved via a shared
      `<LetterSignoffFields>` component
      (`components/LetterSignoffFields.tsx`) that the Export link's own
      route then reads at generation time. `SignaturePad.tsx` moved from
      `app/(app)/event-reports/` to `components/` so both it and
      Event Reports' own signer flow share the one implementation.
      Verified end-to-end via the real API for every section, including
      the signed vs. unsigned export path and F.5's two variants
      actually differing (Plan omits status/notes, Progress includes
      them) — all test data cleaned up afterward. (Chapter Account/
      Expense Report — originally F.4/F.5's siblings here as §G.4/§G.6
      — were removed in Aug 2026; see Chapter Finances above.)
      **Shared UI pulled into `components/`**: `Section`/`MemberSelect`/
      `inputClass`/`labelClass`/`th`/`td` moved from the old
      `StandardsFormsClient.tsx` (now deleted) into
      `components/FormSection.tsx` so Academics/Sisterhood/Leadership/
      Chapter Finances' new sections could all reuse the same
      collapsible-section chrome instead of four copies of it.
- [x] **Event Reports** — `app/(app)/event-reports`
      The real national "Event Report" form — one form used across ~18
      different Chapter Standards credits (`lib/eventReports.ts`
      `EVENT_REPORT_STANDARDS`, built directly off Chapter Standards
      Approved 08-2026 by grepping every credit whose Documentation line
      says "Use the official Event Report form"): A.3, C.1, C.2, C.5,
      C.7, D.3, D.5, D.6, D.7, D.9, E.3, E.6, H.1, H.3, H.6, H.7, H.8,
      H.9. The "Standard Being Fulfilled (section and sub-section)"
      dropdown is grouped by Chapter Standards section, and each option
      carries the real doc's own "who must sign" line as helper text —
      several of these are explicitly *not* the Chapter officer
      submitting the report (a presenter, a Greek Life advisor, a NALFO
      officer), which is why `EventReport.signerName` is free text and
      `signerMemberId` is an optional link to a Roster member rather
      than a required one.
      Source template mismatch, same situation Meeting Minutes hit: the
      Drive's `Templates/Event Report .docx` has real letterhead
      (crest + fonts) but its body is a thin, inconsistently-structured
      auto-conversion — combined single-run "Signature Date :" and
      "Printed Name Title/Office :" fields, and no "Standard Being
      Fulfilled" line at all (found by cross-checking against the
      authoritative `SON Event Report.pdf` under Shared with Chapters).
      Rather than fight that structure with anchor-based patching (see
      `lib/docxPatch.ts`), `lib/eventReportExport.ts` keeps only the
      letterhead (header1.xml + its own crest image/fonts, referenced
      via document.xml's existing `rId7`) and rebuilds the entire
      `<w:body>` fresh on every export, in the master PDF's real field
      order, including the missing "Standard Being Fulfilled" field.
      **Signatures**: drawn in-browser (`SignaturePad.tsx`, pointer
      events so mouse/trackpad/touch all work the same way) rather than
      uploaded, then embedded into the exported docx as a real inline
      image — a new `word/media/signature.png` plus a new relationship
      in `word/_rels/document.xml.rels`, sized to fit a max 2in × 0.8in
      box while preserving the PNG's own aspect ratio (read directly off
      its IHDR chunk's width/height bytes — no image library needed for
      just that). Finding the next free relationship ID scans *every*
      `Id="rIdN"` already in that one rels file rather than one
      relationship type — a scoped scan is exactly what caused a real
      rId collision bug while building Meeting Minutes (that file is the
      single authoritative source of truth for "already used", so this
      doesn't need Meeting Minutes' extra footer-reference caveat).
      A signature can also be *saved* per Roster member
      (`MemberSignature`, one row per member) so it auto-loads onto the
      pad the next time that member is picked as signer instead of
      needing to be redrawn — opt-in via a checkbox shown only when the
      signer is a Roster member, so a one-off external signer (the
      presenter/advisor/NALFO-officer cases above) never gets a
      signature persisted anywhere without being asked. Nothing about
      this reuses or is patterned after the shared-password app login —
      it's just member-scoped image storage.
      **Centering bug found via a real exported doc, twice**: first fix
      (wrong diagnosis) guessed the source .docx's own margins were
      asymmetric (537.6/1044 twips) and averaged them down to a
      symmetric-but-shrunk 791/791. That number never actually came from
      the template — reading `word/document.xml` straight out of the
      shipped .docx shows its real `sectPr` margins are already
      symmetric: 1440/1440 (a standard 1"). Shrinking to 791 broke a
      *different* thing: the header's crest image
      (`word/header1.xml`) is positioned with a large negative offset
      from the left margin (`wp:posOffset>-771523</`, calibrated for the
      real 1440-twip margin) — at 791 twips that offset pushed the
      crest's absolute X position negative, hanging it off the left edge
      of the page. That's what the user meant by "still off centered,
      left" even after the first fix shipped. Real fix: just match the
      template's actual 1440/1440 — keeps the crest at its designed spot
      and centers the page for real. (The *non-integer-twips* half of
      the original diagnosis was still worth knowing —
      `ST_TwipsMeasure` is an integer type, Word tolerates a non-integer
      value silently but python-docx rejects it — just not the actual
      cause here.)
      **Refactored for reuse**: once Official Standards Forms' new
      letter-style credits (below) needed the exact same paragraph/
      signature-embedding primitives, they were pulled out of this file
      into `lib/docxLetterhead.ts` (`eventReportExport.ts` now imports
      from there too, rather than keeping a second copy), and
      `SignaturePad.tsx` moved from this module's own folder to
      `components/` so `<LetterSignoffFields>` could use it too.
- [ ] **Alumnae**
      Source folder: `Positions Binders/Alumnae Relations` (currently
      empty in the drive — will need to figure out what this module
      actually tracks when we get to it).
- [ ] **Risk Management**
      Source folder: `Positions Binders/Risk Management` (also empty
      right now — same as above).

**Third Aug 2026 pass** — two smaller additions, both on the Dashboard:

- **Calendar module** (`lib/calendar.ts`, `app/(app)/calendar/`) — a
  plain `<iframe>` embed of the chapter's existing public Google
  Calendar (`calendar.google.com/calendar/embed?src=...`), given its
  own module (`open` pattern — read-only, nothing to own) so it's one
  click from the sidebar instead of a separate bookmark nobody
  remembers. A small client-side toggle (`CalendarEmbed.tsx`) swaps the
  embed's own `mode` param between Upcoming (`AGENDA`), Month, and Week
  — "what's coming up" is the Agenda view, so that's the default. No
  Google API/credentials involved anywhere — it's exactly as private as
  the calendar's own sharing settings already make it, since anyone
  with the embed URL could already see it outside the app too.
- **Personal To-Do list** (`lib/toDoList.ts`, `components/MyToDoList.tsx`)
  — a Dashboard widget, computed fresh on every load rather than a list
  anyone maintains by hand. Four checks, each linking to wherever she'd
  actually go handle it: (1) for each position she holds, is there an
  `OfficerReport` on file yet for the most recently logged `Meeting`;
  (2) Active members only — has she voted in this month's still-open
  Sister of the Month ballot (same rules as
  `app/api/standards/sister-of-month/vote/route.ts`); (3) does she have
  a positive account balance (`calculateBalance()`, `lib/fines.ts`) —
  shown as plain text with no link, since Fines & Member Accounts is
  Treasurer/President-`locked` and there's genuinely nowhere for a
  general member to click through to yet; (4) Active/Inactive only —
  has she logged 6+ study hours (`WEEKLY_HOURS_REQUIRED`) in the
  current calendar week (`weekStart()`, `lib/studyHours.ts`). An empty
  list renders nothing, not an empty card.
- **Meeting-minutes email reminders** (`lib/email.ts`,
  `lib/meetingReminders.ts`, `app/api/cron/meeting-reminders`,
  `vercel.json`) — every Active member with an email on file gets one,
  the day before each scheduled meeting (President confirmed: deployed
  to Vercel, sent from a chapter Gmail account). A few real constraints
  worth knowing:
  - Driven off `MeetingSchedule` (the recurring *rule*), not logged
    `Meeting` rows — tomorrow's Meeting record usually doesn't exist
    yet (those get logged around/after the meeting via "+ Log a
    Meeting"). What actually goes out is the *previous* logged
    Meeting's minutes from that same series, as both a `.docx`
    attachment and a link to its Final Version page — "review last
    time's minutes before you come," not tonight's (which don't exist
    yet 24 hours out).
  - "24 hours before" is really "once daily, the day before" — Vercel's
    free (Hobby) tier only allows once-a-day cron schedules, so
    `vercel.json` runs `app/api/cron/meeting-reminders` once at a fixed
    UTC hour rather than tracking each meeting's exact time. Good
    enough for a reminder; a chapter that later wants hour-precision
    timing would need a paid Vercel plan (more frequent cron allowed)
    or a different scheduler.
  - `MeetingReminderLog` (new model, unique on `(scheduleId,
    meetingDate)`) makes the whole thing idempotent — a retried or
    manually re-triggered cron run just reports "already sent" instead
    of double-emailing the chapter. Live-tested end to end (auth
    rejection, a schedule genuinely due "tomorrow," and the idempotency
    guard) using a temporary test schedule + a manually inserted log
    row, both removed after.
  - Sending itself (`lib/email.ts`) is plain SMTP via `nodemailer`
    against Gmail (`service: "gmail"`, an App Password — not the
    account's real login password, which 2FA blocks here on purpose),
    not the Gmail API — no OAuth consent flow to maintain. Needs
    `GMAIL_USER`/`GMAIL_APP_PASSWORD` set (`.env.example`) before it can
    actually send anything; until then it throws a clear "not
    configured" error rather than pretending to succeed. The cron route
    itself only accepts requests carrying `Authorization: Bearer
    $CRON_SECRET` (Vercel signs its own cron triggers with this
    automatically once `CRON_SECRET` is set as a project env var) —
    and had to be added to `proxy.ts`'s matcher exclusions, since the
    session-cookie middleware was otherwise bouncing Vercel's
    cookie-less cron request straight to `/login` before the route ever
    ran (caught via a real `curl`, not by reading the code).
  - Still needs from the President before this goes live: the chapter
    Gmail account + its App Password, and `APP_BASE_URL` set to the
    real deployed URL once it exists.

**Chapter Assistant (Aug 2026)** — a RAG chatbot over the chapter's
governing documents, floating as a chat bubble on every page behind login
(`components/ChapterAssistantWidget.tsx`, mounted once from
`app/(app)/layout.tsx`; `POST /api/chapter-assistant`). Started life as a
spec for a *public*, no-login widget on a separate Python/FastAPI service —
neither premise fit this app (no public site exists here at all, and this
is Next.js/Prisma, not Python), so it was rebuilt native and behind the
existing member login instead; see the plan this was built from for the
full reasoning.

- **Access**: `open` in spirit (every logged-in member), but not a real
  `ModuleKey` — it's a persistent overlay, not a page, so it's just gated
  by `getCurrentMember()` directly in the route (on top of `proxy.ts`'s
  usual session-cookie check, same as everything else).
- **Document scope, deliberately narrow (v1)**: only the 12 PDFs in
  `rag/source_docs/` — Chapter/National Bylaws, Standards, Standing Rules,
  Traditions, Code of Ethics, the Alumnae Advisory Committee doc, the
  Undergraduate Expansion Process, and Standardized Pledgeship. These are
  the newest-dated copy of three duplicates found across the source drive
  export (`Shared with Chapters/Organizational Structure/Official
  Documents - Updated by JR 8.24.26/`). **Deliberately excluded, even
  though this is behind login** — don't widen the ingest folder to include
  these without re-deciding this on purpose: `Accounts And Passwords.docx`
  (credentials have no business in an LLM-queryable index, ever), the
  Financial Books and any individual member's Study Hours/Community
  Service spreadsheets (personal/financial records that already have their
  own access-controlled modules — a chatbot answering them would bypass
  `lib/permissions.ts`'s Treasurer/self-service gating on those exact
  things). Positions Binders and Pledgeship rubrics/forms were left out of
  v1 just to keep the first pass small, not for a sensitivity reason —
  fine to add later.
- **How it actually works**: `scripts/rag-ingest.ts` (`npm run rag:ingest`)
  extracts text per PDF (`pdf-parse`), chunks it paragraph-aware
  (`lib/rag/chunk.ts`, ~500-800 words with ~90 word overlap, tracking the
  nearest ARTICLE/Section-style heading as best-effort metadata), embeds
  every chunk locally with a quantized `all-MiniLM-L6-v2`
  (`@huggingface/transformers` — in Next's own `serverExternalPackages`
  allowlist, so it just works on Vercel with no config), and writes it all
  to a single committed `rag/index.json` (~2MB, no vector DB needed at
  this corpus size — `lib/rag/retriever.ts` just loads it into memory once
  per warm instance and does a linear cosine-similarity scan). The model
  weights themselves (`rag/models/`, ~23MB quantized) are also committed,
  and the app's own runtime (`lib/rag/embed.ts`) forces
  `allowRemoteModels = false` — it only ever reads that local copy, never
  Hugging Face's hub, so there's no external dependency (or cost) at
  request time. Both get shipped to Vercel via `outputFileTracingIncludes`
  in `next.config.ts` (same mechanism already used there for
  `lib/templates/**/*`), since neither is actually `import`ed.
  `lib/rag/prompt.ts` is the one real outside call this feature makes:
  Groq's free tier (`llama-3.3-70b-versatile`, `GROQ_API_KEY`) for
  generation only, with a system prompt that requires citing the source
  document and saying "I don't have that information" rather than
  fabricating a policy detail when retrieval comes up empty/irrelevant.
- **To update it**: replace/add a PDF in `rag/source_docs/`, rerun
  `npm run rag:ingest`, commit the changed source file + the regenerated
  `rag/index.json`.
- **Verified so far**: retrieval quality directly (Step-8-style questions
  score 0.4-0.6 similarity against real chunks; an unrelated control
  question scores 0.09-0.12 — good separation), and that an unauthenticated
  request to the API route gets bounced to `/login` same as every other
  route.

**Groq model swap (Aug 2026)** — `llama-3.3-70b-versatile` (the model this
was originally built against) was retired from Groq's free tier at some
point after launch; a real question in production came back a 404
`model_not_found`. Switched to `openai/gpt-oss-120b`, the strongest
general instruct model on Groq's current free catalog — checked via
`GET https://api.groq.com/openai/v1/models` rather than guessing a name
from memory, since Groq's free-tier lineup changes. Also discovered this
account's free tier caps every model alike at **8000 tokens/minute**,
shared across every member hitting this one endpoint (not per-member) —
confirmed via the `x-ratelimit-limit-tokens` response header. Trimmed
retrieval from top-5 to top-4 chunks and capped `max_tokens: 700` on the
response to leave headroom in that budget, and added a distinct
`GroqRateLimitError` (`lib/rag/prompt.ts`) so a 429 surfaces as "ask again
in ~15 seconds" instead of a generic failure. First real end-to-end
generation (not just retrieval) was verified this pass — an actual
community-service-hours question came back accurate and correctly cited.

**Corpus expansion (Aug 2026)** — widened from the original 12 core
governance PDFs to 65 documents, pulling in everything else from
`Upd. SON Drive 8.8.26/` that isn't personal information, at the
President's request. Added `mammoth` for `.docx` extraction (the original
pipeline was PDF-only) and made `scripts/rag-ingest.ts` walk
`rag/source_docs/` recursively — the new material is organized into
`rag/source_docs/{pledgeship,reference,disaffiliated-organizations}/`
subfolders purely for maintainability; the folder path isn't shown to
members (`lib/rag/prompt.ts displayName()` strips it, citing just the
filename).

- **What got added**: every Pledgeship Documents - 2025 binder file that's
  a blank template/form/rubric — contracts, disclaimers, applications,
  progress report, calendar example, assignment rubrics, officer
  descriptions, founding history, etc. (all individually opened and
  confirmed blank/generic before adding, not just judged by filename —
  the pledge/chapter-sister contracts in particular looked risky by name
  alone but turned out to be genuinely blank, underscored-blank-for-a-
  signature templates); a handful of standalone reference PDFs/docx
  (Scholarship Application, Event Report, Third Party Alcohol Provider
  Verification, Sunnie Summit packet, Email Etiquette, Academic How-Tos,
  Minutes Template); and — **the one deliberate exception to "not personal
  info, so it's fine"**, included only after explicitly flagging it to the
  President as a different risk category and getting a direct answer — the
  14 Sexual Misconduct Disaffiliation letters plus the disaffiliated-orgs
  list. Those name *other* real organizations in connection with
  misconduct findings, which isn't personal information about a member but
  carries its own downside if an LLM ever misquotes or paraphrases it
  imprecisely; included because the President asked for it directly, not
  because it cleared some automatic bar.
- **What stayed out, and why**: the usual hard exclusions (credentials,
  Financial Books, individual members' Study Hours/Community Service
  spreadsheets) plus, this pass — `Pledge Committee Contact Info.docx`
  (real names/phone/email); `Copy of Final - Beyond the 6 - Resume.docx`
  (someone's actual resume); every duplicate/superseded copy across the
  three near-identical Official Documents subtrees and the old dated
  Pledgeship Forms/contracts under "Old documents" (redundant/stale, not a
  privacy call — those old ones turned out to be blank templates too when
  checked); and every `.pptx`/`.mp4` (out of format scope — no slide/video
  transcription pipeline exists here). The xlsx form templates (Chapter
  Standard Forms, Roster templates, Pledgeship Forms spreadsheets) were
  also left out this pass: confirmed genuinely blank (no real names in
  their `sharedStrings.xml`) but almost entirely field-label content with
  little prose for RAG to actually answer questions from — not worth the
  added xlsx-extraction complexity yet. Fine to add later if a real
  question needs one.
- **One real extraction failure, found and fixed**: `Crafting Your
  Resume.pdf` extracted to nothing but page-number footers (`-- 1 of 22
  --`, etc.) — its actual content was apparently rendered as graphics
  rather than selectable text (a polished slide-deck export, most likely),
  which `pdf-parse` can't read. Caught by auditing every chunk's word count
  after ingest, not by chance — removed the file rather than ship a
  citation that points at zero real content. Worth re-running that same
  audit (`grep`-style scan for suspiciously short/page-marker-only chunks)
  after adding any future presentation-style PDF.
- **Retrieval quality note**: a few very short, single-chunk documents
  (e.g. `Pledgeship Calendar Example.pdf`, tabular rather than prose) don't
  always win top-4 against more narrative documents for a generic query —
  MiniLM is a small model and tabular content embeds less distinctively
  than prose. ~~Not a bug, just a limit of this free/local embedding
  model~~ — fixed by the embedding model swap below (Pledgeship Calendar
  now ranks #2 for the same query it used to miss entirely).

**Widget upgrade pass (Aug 2026)** — streaming, markdown rendering,
clickable sources, feedback, and a question log, all in one pass at the
President's request. Also caught two real personal-data leaks along the
way (see below) — worth internalizing the lesson, not just the fix.

- **Streaming answers** (`lib/rag/prompt.ts streamAnswer()`,
  `app/api/chapter-assistant/route.ts`) — Groq's `stream: true` SSE
  response is unwrapped down to plain text deltas server-side, then piped
  through as a `ReadableStream` `Response` body. Wire format is
  deliberately simple rather than real SSE: the very first line is one
  JSON object (`{sources, interactionId}` — both known right after
  retrieval, before generation even starts), then every byte after that
  first newline is raw answer text as it's generated.
  `components/ChapterAssistantWidget.tsx` reads the body with
  `response.body.getReader()`, buffers up to that first newline once, then
  appends everything after straight into the message being displayed.
  Errors that happen *before* Groq's response starts (missing key, rate
  limit, model error) still come back as a normal JSON error with the
  right status code — only a genuinely-started 200 commits to streaming —
  so `GroqRateLimitError` handling didn't need to change at all.
- **Markdown rendering** (`react-markdown` + `remark-gfm`, new
  dependencies) — the system prompt now explicitly tells the model
  Markdown is supported (tables especially; the community-service-hours
  answer naturally wants one). Custom `components` map in the widget
  since there's no `@tailwindcss/typography` plugin installed — just
  enough styling for what the prompt actually asks for (lists, bold,
  headings-as-bold, tables, inline code, links).
- **Auto-scroll, actually correct now**: replaced the old one-shot
  `finally`-block scroll with a `useEffect` keyed on the whole `messages`
  array, so it re-fires on every streamed chunk (each one is a `setMessages`
  call) as well as on send — previously it only scrolled once, after the
  full non-streamed response landed.
- **Clickable sources**: `rag/source_docs/` moved to
  `public/rag-source-docs/` — served as a plain static asset (no API
  route needed), but **still session-gated**: `proxy.ts`'s matcher
  protects everything except `login`/`signup`/`api/auth`/`api/cron`/
  `_next/*`, which includes arbitrary `public/` paths too (verified with a
  real unauthenticated `curl` — 307 to `/login`, not a bypass). Citations
  in the widget now link straight to the actual PDF/docx. `lib/rag/prompt.ts`
  returns `Source = {name, path}` instead of a bare display-name string so
  the widget has something to link to.
- **Feedback + question log** (`ChapterAssistantInteraction` model, new
  migration `add_chapter_assistant_log`) — one row per question, created
  right after retrieval (`answer: ""` placeholder) so there's an id to
  attach a rating to before streaming even finishes, then updated with the
  full answer once the stream ends. 👍/👎 buttons in the widget call
  `PATCH /api/chapter-assistant/feedback/[id]` (only the asker or the
  President may rate a given row). `/chapter-assistant-log`
  (`app/(app)/chapter-assistant-log/page.tsx`) is a plain read-only table
  of the last 100 questions — open to every logged-in member, not on the
  sidebar (reached via a link in the widget itself), since it's a
  diagnostic view rather than a module. `topScore` (best retrieval
  similarity for that question) is stored as a rough "does the corpus
  actually cover this" signal for whoever's reading the log — deliberately
  *not* turned into an automatic threshold/flag in code, since BGE's raw
  score range shifted after the embedding model swap below (a totally
  unrelated control question now scores ~0.43, not ~0.1 like MiniLM) —
  eyeball it relative to other rows, don't trust an absolute number.
- **Embedding model swap: MiniLM → `Xenova/bge-small-en-v1.5`**
  (`lib/rag/embed.ts`) — noticeably better ranking on the exact cases
  MiniLM struggled with (pledgeship calendar, officer descriptions, the
  specific misconduct letter beating the generic org list). BGE is trained
  *asymmetrically* — queries need an instruction prefix
  (`"Represent this sentence for searching relevant passages: "`) prepended
  for good retrieval accuracy, documents don't — so `embed.ts` now exports
  separate `embedQuery()` (retriever.ts) and `embedDocument()`/
  `embedDocumentBatch()` (rag-ingest.ts) rather than one generic
  `embedText()`. Also switched pooling from `"mean"` to `"cls"` — BGE
  models are trained on the `[CLS]` token's representation, not a mean
  pool. Re-ran `rag:ingest` against the full corpus after the swap; the
  model cache in `rag/models/` had to be cleared and re-downloaded (it's
  keyed by directory, not model id).
- **xlsx ingestion, and two real personal-data catches** (`lib/rag/xlsx.ts`,
  new) — a from-scratch `.xlsx`-as-zip-of-XML text extractor (same
  "read via JSZip" habit as `lib/xlsxPatch.ts`, just reading instead of
  surgically editing), since no xlsx library was already a dependency.
  Every sheet's cells get joined into row-lines; the sheet name is forced
  as every resulting chunk's `section` since `chunk.ts`'s ARTICLE/Section
  heading-detection has no chance against pure spreadsheet text.
  **Before adding any xlsx to the corpus, each one was actually opened and
  checked — not just judged by filename — and it's a good thing**:
  `Officer & Active Roster Template.xlsx`, despite its name, turned out to
  be **filled with the real, current officers' names and personal chapter
  email addresses** (President, VP, etc.) — excluded. `Copy of Meet the
  Clubs Reimbursement.xlsx` turned out to be an **actual past event's
  filled expense report** (real purchases, real dollar amounts), not a
  blank template — excluded as financial data, same bucket as the
  Financial Books. Both would have been added on filename alone ("Template",
  "Copy of..."). Only genuinely-blank ones made it in: the combined
  Chapter Standard Forms workbook (12 sheets, B1-B3/C3-C6 checklists),
  Chapter Roster Template, a real blank SON Expense Budget template
  (renamed from "Copy of SON Expense Budget.xlsx" for clarity), and the
  Pledgeship induction/initiation forms spreadsheet (confirmed blank via
  its `sharedStrings.xml` containing zero real names before it was added).
  `rag-ingest.ts` also now flags any file that yields under 15 words of
  extracted text as suspect in its own output — the same failure mode that
  caught `Crafting Your Resume.pdf` last pass, now checked automatically
  instead of by a manual audit script.
- **Unrelated build break, found and fixed in passing**: `npm run build`
  failed on an unrelated pre-existing TypeScript error in
  `RosterClient.tsx` (`STATUS_BADGE_CLASSES` missing the `GENERAL` status
  some other change had added to `lib/roster.ts`) — added the missing
  entry so the build (and this work) could actually be verified.

**Self-service signup + President-sent invites** (Aug 2026) — a sister no
longer needs the President to set her initial password from Manage
Officers & Logins; she can create her own account.

- `/signup` (`app/signup/page.tsx`) — mirrors `/login`'s look, but the
  picker (`GET /api/auth/unclaimed-members`) only lists Members who
  **don't** have a password yet, the inverse of `/api/auth/members`'s
  login picker. Gated by a single shared `SIGNUP_PASSWORD` (a chapter-wide
  "you're actually one of us" secret, not anyone's real login password —
  checked server-side in `POST /api/auth/signup`) rather than open to the
  world. Deliberately can't create a brand-new `Member` row — only claims
  one the President already added to the Roster, and only if it doesn't
  already have a password (same "already set up" error either way, so it
  can't be used to probe who's signed up yet). Successful signup logs her
  straight in, same as `/api/auth/login`.
- **President-sent email invites** (`app/(app)/officers/OfficersClient.tsx`,
  `POST /api/officers/invite`) — a button per unclaimed member (and one
  "invite everyone unclaimed at once") on Manage Officers & Logins,
  emailing her the `/signup` link plus the `SIGNUP_PASSWORD` directly, so
  she doesn't have to go ask an officer for it. Sent from the same chapter
  Gmail account already configured for meeting-minutes reminders
  (`lib/email.ts`'s `GMAIL_USER`/`GMAIL_APP_PASSWORD` — the VP of
  Communications' account per the President, already set as a Vercel env
  var; nothing new to configure) — added `isEmailConfigured()` to that
  file so this route can give one clear "not configured" error up front
  instead of every individual send failing separately. Only ever emails
  members with no login yet AND an email on file; skips (and reports,
  doesn't silently drop) anyone missing an email.
- `proxy.ts`'s matcher gained `signup` alongside `login` — same reasoning,
  needs to be reachable with no session cookie.
- **Live-tested**: every validation branch on `/api/auth/signup` (wrong
  chapter password, bogus/missing member id, short password) via direct
  `curl`, and that an unauthenticated `POST /api/officers/invite` gets
  bounced by `proxy.ts` same as every other protected route. **Not
  tested**: an actual successful signup or invite send — the dev DB (now
  shared Supabase Postgres, not a disposable local SQLite file since the
  Aug 28 migration) had no unclaimed test member on hand to safely use,
  and fabricating one felt riskier on a database other active sessions
  might be looking at than it was worth. Both routes closely mirror
  already-proven code (`/api/auth/login`, `/api/officers/[id]/password`,
  the meeting-reminder cron's email send), so this is a reasonable bet,
  not a blind one — but worth an officer's own click-through once
  `GMAIL_USER`/`GMAIL_APP_PASSWORD`/`SIGNUP_PASSWORD` are actually set.

## Not modules, just reference

A few things in the source drive aren't chapter-data modules, just
governing documents (bylaws, standing rules, traditions, standards) under
`Official Documents - Updated 8.8.26/`. The current copy used for the
Chapter Assistant lives in `rag/source_docs/` (see above) — nothing else
to build for the rest, but worth remembering they exist if a future module
ever needs to link out to them or quote a policy.
