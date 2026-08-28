-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BudgetVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "salesTaxRate" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "dateDue" TEXT,
    "motion" TEXT,
    "second" TEXT,
    "vote" TEXT,
    "checkNumber" TEXT,
    "checkAmount" REAL,
    "dateReceived" TEXT,
    "submittedBy" TEXT,
    "dateSubmitted" TEXT,
    "datePresented" TEXT,
    "status" TEXT,
    "reimbursementMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetVersion_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BudgetVersion" ("budgetId", "checkAmount", "checkNumber", "createdAt", "dateDue", "datePresented", "dateReceived", "dateSubmitted", "id", "motion", "notes", "reimbursementMethod", "salesTaxRate", "second", "stage", "status", "submittedBy", "updatedAt", "vote") SELECT "budgetId", "checkAmount", "checkNumber", "createdAt", "dateDue", "datePresented", "dateReceived", "dateSubmitted", "id", "motion", "notes", "reimbursementMethod", "salesTaxRate", "second", "stage", "status", "submittedBy", "updatedAt", "vote" FROM "BudgetVersion";
DROP TABLE "BudgetVersion";
ALTER TABLE "new_BudgetVersion" RENAME TO "BudgetVersion";
CREATE UNIQUE INDEX "BudgetVersion_budgetId_stage_key" ON "BudgetVersion"("budgetId", "stage");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

