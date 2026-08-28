-- CreateTable
CREATE TABLE "EventReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventReport_signerMemberId_fkey" FOREIGN KEY ("signerMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberSignature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberSignature_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberSignature_memberId_key" ON "MemberSignature"("memberId");
