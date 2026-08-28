-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventName" TEXT NOT NULL,
    "chair" TEXT,
    "eventDate" TEXT,
    "budgetNumber" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'TENTATIVE',
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BudgetLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "price" REAL NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetLineItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
