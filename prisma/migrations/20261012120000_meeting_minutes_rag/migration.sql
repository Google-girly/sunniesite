-- AlterTable
ALTER TABLE "MeetingFinalMinutes" ADD COLUMN     "ragIndexedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MeetingMinutesChunk" (
    "id" TEXT NOT NULL,
    "finalMinutesId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "meetingDate" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingMinutesChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingMinutesChunk_finalMinutesId_idx" ON "MeetingMinutesChunk"("finalMinutesId");

-- AddForeignKey
ALTER TABLE "MeetingMinutesChunk" ADD CONSTRAINT "MeetingMinutesChunk_finalMinutesId_fkey" FOREIGN KEY ("finalMinutesId") REFERENCES "MeetingFinalMinutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

