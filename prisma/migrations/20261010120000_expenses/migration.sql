-- Business expenses for the Accounts section (profit & loss). Additive only.
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseNumber" TEXT NOT NULL,
    "spentOn" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentMethod" TEXT NOT NULL,
    "paidTo" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "updatedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Expense_expenseNumber_key" ON "Expense"("expenseNumber");
CREATE INDEX "Expense_spentOn_idx" ON "Expense"("spentOn");
