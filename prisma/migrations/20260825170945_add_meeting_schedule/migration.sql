-- CreateTable
CREATE TABLE "MeetingSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "anchorDate" TEXT NOT NULL,
    "time" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
