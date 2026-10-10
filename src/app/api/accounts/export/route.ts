import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-errors";
import { generateSafeCsv } from "@/lib/export-csv";
import { methodLabel } from "@/lib/accounts-shared";
import { profitAndLoss, readRange } from "@/lib/services/accounts";

/** Profit & loss for a date range as a spreadsheet: summary, then every sale and expense (owner and Accounts). */
export const GET = withErrorHandling("GET /api/accounts/export", async (req) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const pnl = await profitAndLoss(user, readRange(sp.get("from"), sp.get("to"), sp.get("basis")));
  const rows: (string | number)[][] = [
    ["Summary", `${pnl.from} to ${pnl.to}`, "", pnl.income.label, "", pnl.income.amount, "", "INR"],
    ["Summary", `${pnl.from} to ${pnl.to}`, "", pnl.trainerPay.label, "", "", pnl.trainerPay.amount, "INR"],
    ["Summary", `${pnl.from} to ${pnl.to}`, "", "Other expenses", "", "", pnl.expenses.amount, "INR"],
    ["Summary", `${pnl.from} to ${pnl.to}`, "", pnl.profit >= 0 ? "Profit" : "Loss", "", pnl.profit >= 0 ? pnl.profit : "", pnl.profit < 0 ? -pnl.profit : "", "INR"],
    ...pnl.sales.map((s) => ["Sale", s.date, s.number, `${s.studentName} (${s.studentCode})`, s.detail, s.amount, "", s.currency]),
    ...pnl.expenseRows.map((e) => [
      "Expense",
      e.spentOn,
      e.expenseNumber,
      `${e.category}: ${e.description}${e.paidTo ? ` (paid to ${e.paidTo})` : ""}`,
      methodLabel(e.paymentMethod),
      "",
      e.amount,
      e.currency,
    ]),
  ];
  const csv = generateSafeCsv(["Type", "Date (IST)", "Number", "Description", "Method / status", "Money in", "Money out", "Currency"], rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="xello_profit_loss_${pnl.from}_to_${pnl.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
