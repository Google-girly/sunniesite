-- CreateTable
CREATE TABLE "LetterSignoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT,
    "signerMemberId" TEXT,
    "signedDate" TEXT,
    "signatureImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LetterSignoff_signerMemberId_fkey" FOREIGN KEY ("signerMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LetterSignoff_section_key_key" ON "LetterSignoff"("section", "key");
