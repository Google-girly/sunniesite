-- AlterTable
ALTER TABLE "Member" ADD COLUMN "class" TEXT;
ALTER TABLE "Member" ADD COLUMN "crossingNumber" INTEGER;
ALTER TABLE "Member" ADD COLUMN "nickname" TEXT;

-- CreateTable
CREATE TABLE "ServiceHourEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "description" TEXT,
    "hours" REAL NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "volunteerContact" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceHourEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MakeUpProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "hoursUncompleted" REAL NOT NULL,
    "project" TEXT,
    "dueDate" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "libraryHoursCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MakeUpProject_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
