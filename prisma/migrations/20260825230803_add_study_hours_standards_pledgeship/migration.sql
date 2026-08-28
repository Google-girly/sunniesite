-- CreateTable
CREATE TABLE "StudyHourEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "timeIn" TEXT,
    "timeOut" TEXT,
    "hours" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyHourEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GpaRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "status" TEXT,
    "termGpa" REAL,
    "cumGpa" REAL,
    "major" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GpaRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mentorship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mentorship_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mentorship_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlphaOrderRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "cumGpa" REAL NOT NULL,
    "major" TEXT,
    "isPlaqueRecipient" BOOLEAN NOT NULL DEFAULT false,
    "scholarshipAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaOrderRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProfessionalDevelopmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "presentedBy" TEXT,
    "date" TEXT,
    "time" TEXT,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProfessionalDevelopmentAttendee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    CONSTRAINT "ProfessionalDevelopmentAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ProfessionalDevelopmentEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfessionalDevelopmentAttendee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProbationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dateInEffectStart" TEXT,
    "dateInEffectEnd" TEXT,
    "offense" TEXT,
    "additionalSanctions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProbationRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "date" TEXT,
    "activesAttended" INTEGER,
    "quorumMet" BOOLEAN,
    "officersAttended" INTEGER,
    "otherAttendees" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SisterOfTheMonth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "memberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SisterOfTheMonth_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "issuedDate" TEXT,
    "expirationDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CertificationRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PledgeClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "chapter" TEXT NOT NULL DEFAULT 'Theta',
    "pinningDate" TEXT,
    "pinningAddress" TEXT,
    "pinningCity" TEXT,
    "crossoverDate" TEXT,
    "crossoverAddress" TEXT,
    "crossoverCity" TEXT,
    "presidentName" TEXT,
    "riskManagementOfficer" TEXT,
    "sergeantAtArms" TEXT,
    "activeMember1" TEXT,
    "activeMember2" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Pledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pledgeClassId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "major" TEXT,
    "bigSister" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLEDGING',
    "notes" TEXT,
    "gpaTermAtPinning" REAL,
    "gpaCumAtPinning" REAL,
    "gpaTermAtCrossover" REAL,
    "gpaCumAtCrossover" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pledge_pledgeClassId_fkey" FOREIGN KEY ("pledgeClassId") REFERENCES "PledgeClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PledgeProgressReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pledgeId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "dayTime" TEXT,
    "instructor" TEXT,
    "currentGrade" TEXT,
    "assignmentAverage" TEXT,
    "missingAssignments" TEXT,
    "attendance" TEXT,
    "overallPerformance" TEXT,
    "comments" TEXT,
    "reportDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PledgeProgressReport_pledgeId_fkey" FOREIGN KEY ("pledgeId") REFERENCES "Pledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PledgeServiceHourEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pledgeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "collective" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PledgeServiceHourEntry_pledgeId_fkey" FOREIGN KEY ("pledgeId") REFERENCES "Pledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalDevelopmentAttendee_eventId_memberId_key" ON "ProfessionalDevelopmentAttendee"("eventId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendanceRecord_term_meetingNumber_key" ON "MeetingAttendanceRecord"("term", "meetingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SisterOfTheMonth_year_month_key" ON "SisterOfTheMonth"("year", "month");
