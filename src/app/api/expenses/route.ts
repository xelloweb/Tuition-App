import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { createExpense } from "@/lib/services/accounts";

/** Records a business expense (owner and Accounts). */
export const POST = withErrorHandling("POST /api/expenses", async (req) => {
  const user = await requireUser();
  const expense = await createExpense(await readJsonObject(req), user);
  return NextResponse.json({ success: true, expense, message: `Expense ${expense.expenseNumber} saved.` }, { status: 201 });
});
