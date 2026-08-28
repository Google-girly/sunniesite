/*
  Warnings:

  - You are about to drop the column `checkAmount` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `checkNumber` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `dateDue` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `dateReceived` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `income` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `motion` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `salesTaxRate` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `second` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `stage` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `vote` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `budgetId` on the `BudgetLineItem` table. All the data in the column will be lost.
  - Added the required column `versionId` to the `BudgetLineItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "BudgetVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "salesTaxRate" REAL NOT NULL DEFAULT 0,
    "income" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "dateDue" TEXT,
    "motion" TEXT,
    "second" TEXT,
    "vote" TEXT,
    "checkNumber" TEXT,
    "checkAmount" REAL,
    "dateReceived" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetVersion_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventName" TEXT NOT NULL,
    "chair" TEXT,
    "eventDate" TEXT,
    "budgetNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Budget" ("budgetNumber", "chair", "createdAt", "eventDate", "eventName", "id", "updatedAt") SELECT "budgetNumber", "chair", "createdAt", "eventDate", "eventName", "id", "updatedAt" FROM "Budget";
DROP TABLE "Budget";
ALTER TABLE "new_Budget" RENAME TO "Budget";
CREATE TABLE "new_BudgetLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "price" REAL NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetLineItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BudgetVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BudgetLineItem" ("createdAt", "id", "item", "price", "quantity", "sortOrder", "taxable") SELECT "createdAt", "id", "item", "price", "quantity", "sortOrder", "taxable" FROM "BudgetLineItem";
DROP TABLE "BudgetLineItem";
ALTER TABLE "new_BudgetLineItem" RENAME TO "BudgetLineItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BudgetVersion_budgetId_stage_key" ON "BudgetVersion"("budgetId", "stage");
