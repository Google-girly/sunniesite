-- EventReport: track who filled the form out (distinct from signerMember,
-- who often isn't the person submitting it at all) so edits can be
-- restricted to her + the President.
ALTER TABLE "EventReport" ADD COLUMN "createdByMemberId" TEXT REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ChapterFundEntry: accountCode and notes become required (every fund
-- must be categorized; every field on the form is now mandatory). Table
-- is empty as of this migration, so a plain recreate is safe — SQLite
-- has no ALTER COLUMN.
CREATE TABLE "new_ChapterFundEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "accountCode" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ChapterFundEntry" ("id", "date", "description", "amount", "accountCode", "notes", "createdAt", "updatedAt")
SELECT "id", "date", "description", "amount", "accountCode", "notes", "createdAt", "updatedAt" FROM "ChapterFundEntry";
DROP TABLE "ChapterFundEntry";
ALTER TABLE "new_ChapterFundEntry" RENAME TO "ChapterFundEntry";
