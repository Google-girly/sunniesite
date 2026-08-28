-- Tracks which (schedule, meeting date) reminder emails have already
-- been sent, so the daily cron job can't double-send.
CREATE TABLE "MeetingReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "meetingDate" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingReminderLog_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MeetingSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MeetingReminderLog_scheduleId_meetingDate_key" ON "MeetingReminderLog"("scheduleId", "meetingDate");
