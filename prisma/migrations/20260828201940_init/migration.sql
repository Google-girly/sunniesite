-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "crossingTerm" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordHash" TEXT,
    "class" TEXT,
    "crossingNumber" INTEGER,
    "nickname" TEXT,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountEntry" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fineCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterStartingBalance" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "asOfDate" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterStartingBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterFundEntry" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "accountCode" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterFundEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "chair" TEXT,
    "eventDate" TEXT,
    "budgetNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetVersion" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "salesTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "dateDue" TEXT,
    "motion" TEXT,
    "second" TEXT,
    "vote" TEXT,
    "checkNumber" TEXT,
    "checkAmount" DOUBLE PRECISION,
    "dateReceived" TEXT,
    "submittedBy" TEXT,
    "dateSubmitted" TEXT,
    "datePresented" TEXT,
    "status" TEXT,
    "reimbursementMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLineItem" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "accountCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingSchedule" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "anchorDate" TEXT NOT NULL,
    "time" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingReminderLog" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "meetingDate" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "scheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerReport" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "report" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficerReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceHourEntry" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "description" TEXT,
    "hours" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "volunteerContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceHourEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakeUpProject" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "hoursUncompleted" DOUBLE PRECISION NOT NULL,
    "project" TEXT,
    "dueDate" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "libraryHoursCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MakeUpProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyHourEntry" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "timeIn" TEXT,
    "timeOut" TEXT,
    "hours" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyHourEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpaRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "status" TEXT,
    "termGpa" DOUBLE PRECISION,
    "cumGpa" DOUBLE PRECISION,
    "major" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GpaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mentorship" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mentorship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlphaOrderRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "cumGpa" DOUBLE PRECISION NOT NULL,
    "major" TEXT,
    "isPlaqueRecipient" BOOLEAN NOT NULL DEFAULT false,
    "scholarshipAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlphaOrderRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalDevelopmentEvent" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "presentedBy" TEXT,
    "date" TEXT,
    "time" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalDevelopmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalDevelopmentAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "ProfessionalDevelopmentAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProbationRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dateInEffectStart" TEXT,
    "dateInEffectEnd" TEXT,
    "offense" TEXT,
    "additionalSanctions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProbationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendanceRecord" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "date" TEXT,
    "activesAttended" INTEGER,
    "quorumMet" BOOLEAN,
    "officersAttended" INTEGER,
    "otherAttendees" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisterOfTheMonth" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SisterOfTheMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisterOfMonthVote" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SisterOfMonthVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificationRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "issuedDate" TEXT,
    "expirationDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventReport" (
    "id" TEXT NOT NULL,
    "standardSection" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "hostingOrganization" TEXT,
    "date" TEXT NOT NULL,
    "lengthOfTime" TEXT,
    "location" TEXT,
    "membersInAttendance" INTEGER,
    "purpose" TEXT NOT NULL,
    "resourcesUtilized" TEXT,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT,
    "signerMemberId" TEXT,
    "signedDate" TEXT,
    "signatureImage" TEXT,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberSignature" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterAdvisor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "officeAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterAdvisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicPlanGoal" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'YEAR',
    "priorityArea" TEXT NOT NULL,
    "goalDescription" TEXT NOT NULL,
    "responsibleOfficer" TEXT,
    "targetTimeline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "progressNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategicPlanGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadershipPosition" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "memberName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "academicYear" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadershipPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterSignoff" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT,
    "signerMemberId" TEXT,
    "signedDate" TEXT,
    "signatureImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterSignoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistOverride" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChapterStartingBalance_year_key" ON "ChapterStartingBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetVersion_budgetId_stage_key" ON "BudgetVersion"("budgetId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingReminderLog_scheduleId_meetingDate_key" ON "MeetingReminderLog"("scheduleId", "meetingDate");

-- CreateIndex
CREATE UNIQUE INDEX "OfficerReport_meetingId_position_key" ON "OfficerReport"("meetingId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalDevelopmentAttendee_eventId_memberId_key" ON "ProfessionalDevelopmentAttendee"("eventId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendanceRecord_term_meetingNumber_key" ON "MeetingAttendanceRecord"("term", "meetingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SisterOfTheMonth_year_month_key" ON "SisterOfTheMonth"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SisterOfMonthVote_year_month_voterId_key" ON "SisterOfMonthVote"("year", "month", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberSignature_memberId_key" ON "MemberSignature"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "LetterSignoff_section_key_key" ON "LetterSignoff"("section", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistOverride_code_key" ON "ChecklistOverride"("code");

-- AddForeignKey
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetVersion" ADD CONSTRAINT "BudgetVersion_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BudgetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLineItem" ADD CONSTRAINT "BudgetLineItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BudgetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingReminderLog" ADD CONSTRAINT "MeetingReminderLog_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MeetingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MeetingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerReport" ADD CONSTRAINT "OfficerReport_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceHourEntry" ADD CONSTRAINT "ServiceHourEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeUpProject" ADD CONSTRAINT "MakeUpProject_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyHourEntry" ADD CONSTRAINT "StudyHourEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpaRecord" ADD CONSTRAINT "GpaRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mentorship" ADD CONSTRAINT "Mentorship_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mentorship" ADD CONSTRAINT "Mentorship_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlphaOrderRecord" ADD CONSTRAINT "AlphaOrderRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalDevelopmentAttendee" ADD CONSTRAINT "ProfessionalDevelopmentAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ProfessionalDevelopmentEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalDevelopmentAttendee" ADD CONSTRAINT "ProfessionalDevelopmentAttendee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProbationRecord" ADD CONSTRAINT "ProbationRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisterOfTheMonth" ADD CONSTRAINT "SisterOfTheMonth_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisterOfMonthVote" ADD CONSTRAINT "SisterOfMonthVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisterOfMonthVote" ADD CONSTRAINT "SisterOfMonthVote_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificationRecord" ADD CONSTRAINT "CertificationRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReport" ADD CONSTRAINT "EventReport_signerMemberId_fkey" FOREIGN KEY ("signerMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReport" ADD CONSTRAINT "EventReport_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSignature" ADD CONSTRAINT "MemberSignature_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadershipPosition" ADD CONSTRAINT "LeadershipPosition_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterSignoff" ADD CONSTRAINT "LetterSignoff_signerMemberId_fkey" FOREIGN KEY ("signerMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

