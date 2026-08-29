-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "typeOther" TEXT,
    "purpose" TEXT NOT NULL,
    "recipientName" TEXT,
    "date" TEXT NOT NULL,
    "createdByMemberId" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
