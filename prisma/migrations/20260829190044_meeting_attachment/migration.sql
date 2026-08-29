-- CreateTable
CREATE TABLE "MeetingAttachment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" TEXT NOT NULL,
    "uploadedByMemberId" TEXT,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MeetingAttachment" ADD CONSTRAINT "MeetingAttachment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttachment" ADD CONSTRAINT "MeetingAttachment_uploadedByMemberId_fkey" FOREIGN KEY ("uploadedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
