-- DropTable: F.4 Officer Transition Meetings removed (use Event Reports instead)
DROP TABLE "OfficerTransition";

-- AlterTable: StrategicPlanGoal gains `period` (Year/Spring/Fall)
ALTER TABLE "StrategicPlanGoal" ADD COLUMN "period" TEXT NOT NULL DEFAULT 'YEAR';

-- AlterTable: Meeting gains an optional link back to the recurring MeetingSchedule it came from
ALTER TABLE "Meeting" ADD COLUMN "scheduleId" TEXT REFERENCES "MeetingSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ChapterStartingBalance
CREATE TABLE "ChapterStartingBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "asOfDate" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ChapterStartingBalance_year_key" ON "ChapterStartingBalance"("year");

-- CreateTable: ChapterFundEntry
CREATE TABLE "ChapterFundEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "accountCode" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: SisterOfMonthVote
CREATE TABLE "SisterOfMonthVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "voterId" TEXT NOT NULL REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "nomineeId" TEXT NOT NULL REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "SisterOfMonthVote_year_month_voterId_key" ON "SisterOfMonthVote"("year", "month", "voterId");
