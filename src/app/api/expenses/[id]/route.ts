import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { deleteExpense, updateExpense } from "@/lib/services/accounts";

type Ctx = { params: Promise<{ id: string }> };

/** Corrects an expense (owner and Accounts); the change is in the audit log. */
export const PATCH = withErrorHandling<Ctx>("PATCH /api/expenses/[id]", async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const expense = await updateExpense(id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, expense, message: `Expense ${expense.expenseNumber} updated.` });
});

/** Deletes an expense entered by mistake; the audit log keeps the full record. */
export const DELETE = withErrorHandling<Ctx>("DELETE /api/expenses/[id]", async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const expense = await deleteExpense(id, user);
  return NextResponse.json({ success: true, message: `Expense ${expense.expenseNumber} deleted.` });
});
