/**
 * Accounts: business expenses and profit & loss for any IST date range.
 *
 * Income and trainer pay come from records the app already keeps (payments,
 * invoices, trainer pay from attendance and payout runs); only other
 * expenses are entered here. Amounts are whole rupees. Money recorded in
 * another currency is listed separately and never added to rupee totals.
 * Owner and Accounts only.
 */
import { Expense } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { canAccessFinancial } from "../auth";
import { forbiddenError, notFoundError, validationError } from "../api-errors";
import { FieldCollector } from "../validation";
import { nextCode, withCodeRetry } from "../codes";
import { dayRangeInZone, localDateInZone } from "../zoned-time";
import {
  Basis,
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  MAX_EXPENSE,
  MAX_RANGE_DAYS,
  addDays,
  daysBetween,
  istToday,
  isYmd,
  monthLabel,
} from "../accounts-shared";

const IST = "Asia/Kolkata";
const istDate = (d: Date) => localDateInZone(d, IST);

function requireFinance(user: CurrentUser) {
  if (!canAccessFinancial(user.role)) throw forbiddenError("Only the owner and Accounts can see and change the accounts.");
}

// ---------------------------------------------------------------- expenses

export interface ExpenseFields {
  spentOn: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  paidTo: string | null;
  reference: string | null;
  notes: string | null;
}

export function parseExpense(body: Record<string, unknown>, today = istToday()): ExpenseFields {
  const v = new FieldCollector();
  const spentOn = typeof body.spentOn === "string" ? body.spentOn.trim() : "";
  if (!isYmd(spentOn)) v.add("spentOn", "Choose the date the money was spent.");
  else if (spentOn > today) v.add("spentOn", "The date cannot be in the future.");
  else if (spentOn < addDays(today, -3650)) v.add("spentOn", "Choose a date within the last 10 years.");
  const category = typeof body.category === "string" ? body.category : "";
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) v.add("category", "Choose a category.");
  const description = v.requiredText("description", body.description, "Description", 200);
  const amount = v.integer("amount", body.amount, "Amount (₹)", { min: 1, max: MAX_EXPENSE });
  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "";
  if (!EXPENSE_METHODS.some((m) => m.value === paymentMethod)) v.add("paymentMethod", "Choose how it was paid.");
  const paidTo = v.optionalText("paidTo", body.paidTo, "Paid to", 120);
  const reference = v.optionalText("reference", body.reference, "Reference", 120);
  const notes = v.optionalText("notes", body.notes, "Notes", 1000);
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);
  return { spentOn, category, description, amount, paymentMethod, paidTo, reference, notes };
}

export async function createExpense(body: Record<string, unknown>, user: CurrentUser) {
  requireFinance(user);
  const fields = parseExpense(body);
  return withCodeRetry(["expense"], () =>
    prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: { ...fields, expenseNumber: await nextCode(tx, "expense"), currency: "INR", createdByName: user.name, createdByRole: user.role },
      });
      await tx.auditLog.create({
        data: { entityType: "EXPENSE", entityId: expense.id, action: "CREATE_EXPENSE", actorRole: user.role, actorName: user.name, details: JSON.stringify(expense) },
      });
      return expense;
    })
  );
}

export async function updateExpense(id: string, body: Record<string, unknown>, user: CurrentUser) {
  requireFinance(user);
  const fields = parseExpense(body);
  return prisma.$transaction(async (tx) => {
    const before = await tx.expense.findUnique({ where: { id } });
    if (!before) throw notFoundError("This expense no longer exists. Refresh the page.");
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, to] of Object.entries(fields)) {
      const from = before[k as keyof Expense];
      if (from !== to) changes[k] = { from, to };
    }
    const expense = await tx.expense.update({ where: { id }, data: { ...fields, updatedByName: user.name } });
    await tx.auditLog.create({
      data: {
        entityType: "EXPENSE",
        entityId: id,
        action: "UPDATE_EXPENSE",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ expenseNumber: before.expenseNumber, changes }),
      },
    });
    return expense;
  });
}

export async function deleteExpense(id: string, user: CurrentUser) {
  requireFinance(user);
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({ where: { id } });
    if (!expense) throw notFoundError("This expense no longer exists. Refresh the page.");
    await tx.expense.delete({ where: { id } });
    // The whole row stays in the audit log; its number is never issued again.
    await tx.auditLog.create({
      data: { entityType: "EXPENSE", entityId: id, action: "DELETE_EXPENSE", actorRole: user.role, actorName: user.name, details: JSON.stringify(expense) },
    });
    return expense;
  });
}

// ---------------------------------------------------------- profit & loss

export interface ProfitAndLoss {
  from: string;
  to: string;
  basis: Basis;
  income: { label: string; amount: number; count: number };
  trainerPay: { label: string; amount: number; count: number };
  expenses: { amount: number; count: number; byCategory: { category: string; amount: number; count: number }[] };
  totalCosts: number;
  profit: number;
  months: { month: string; label: string; income: number; trainerPay: number; expenses: number; profit: number }[];
  /** Income recorded in another currency: listed, never added to rupee totals. */
  otherCurrencies: { currency: string; amount: number; count: number }[];
  /** What is not counted and why (unverified payments, unpaid trainer pay…). */
  notes: string[];
  sales: { id: string; date: string; number: string; studentId: string; studentName: string; studentCode: string; detail: string; amount: number; currency: string }[];
  expenseRows: (Omit<Expense, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string })[];
}

/** Checks a requested range; defaults to this month in IST. */
export function readRange(from: unknown, to: unknown, basis: unknown, today = istToday()) {
  const f = isYmd(from) ? from : `${today.slice(0, 7)}-01`;
  const t = isYmd(to) ? to : today;
  if (f > t) throw validationError("The start date must be on or before the end date.", { from: "The start date must be on or before the end date." });
  if (daysBetween(f, t) > MAX_RANGE_DAYS) throw validationError("Choose a range of 3 years or less.", { from: "Choose a range of 3 years or less." });
  return { from: f, to: t, basis: (basis === "EARNED" ? "EARNED" : "CASH") as Basis };
}

function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); ) {
    out.push(m);
    const [y, mm] = m.split("-").map(Number);
    m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
  }
  return out;
}

export async function profitAndLoss(user: CurrentUser, range: { from: string; to: string; basis: Basis }): Promise<ProfitAndLoss> {
  requireFinance(user);
  const { from, to, basis } = range;
  const window = dayRangeInZone(from, to, IST)!;
  const months = new Map(monthsBetween(from, to).map((m) => [m, { income: 0, trainerPay: 0, expenses: 0 }]));
  const bump = (date: string, key: "income" | "trainerPay" | "expenses", amount: number) => {
    const m = months.get(date.slice(0, 7));
    if (m) m[key] += amount;
  };
  const notes: string[] = [];
  const other = new Map<string, { amount: number; count: number }>();
  const sales: ProfitAndLoss["sales"] = [];
  let income = 0;
  let incomeCount = 0;

  if (basis === "CASH") {
    const payments = await prisma.payment.findMany({
      where: { receivedDate: { gte: window.gte, lt: window.lt } },
      include: { student: { select: { id: true, name: true, studentCode: true } } },
      orderBy: { receivedDate: "asc" },
    });
    let unverified = 0;
    let unverifiedSum = 0;
    for (const p of payments) {
      if (!p.isVerified) {
        unverified++;
        unverifiedSum += p.amount;
        continue;
      }
      const date = istDate(p.receivedDate);
      sales.push({ id: p.id, date, number: p.paymentNumber, studentId: p.student.id, studentName: p.student.name, studentCode: p.student.studentCode, detail: p.paymentMethod, amount: p.amount, currency: p.currency });
      if (p.currency !== "INR") {
        const o = other.get(p.currency) ?? { amount: 0, count: 0 };
        other.set(p.currency, { amount: o.amount + p.amount, count: o.count + 1 });
        continue;
      }
      income += p.amount;
      incomeCount++;
      bump(date, "income", p.amount);
    }
    if (unverified) notes.push(`${unverified} payment${unverified === 1 ? "" : "s"} (₹${unverifiedSum.toLocaleString("en-IN")}) recorded but not yet verified ${unverified === 1 ? "is" : "are"} not counted.`);
  } else {
    const invoices = await prisma.invoice.findMany({
      where: { status: { not: "CANCELLED" }, issueDate: { gte: window.gte, lt: window.lt } },
      include: { student: { select: { id: true, name: true, studentCode: true } } },
      orderBy: { issueDate: "asc" },
    });
    let unpaid = 0;
    for (const inv of invoices) {
      const date = istDate(inv.issueDate);
      sales.push({ id: inv.id, date, number: inv.invoiceNumber, studentId: inv.student.id, studentName: inv.student.name, studentCode: inv.student.studentCode, detail: inv.status, amount: inv.totalAmount, currency: inv.currency });
      if (inv.currency !== "INR") {
        const o = other.get(inv.currency) ?? { amount: 0, count: 0 };
        other.set(inv.currency, { amount: o.amount + inv.totalAmount, count: o.count + 1 });
        continue;
      }
      income += inv.totalAmount;
      incomeCount++;
      unpaid += inv.balanceDue;
      bump(date, "income", inv.totalAmount);
    }
    if (unpaid) notes.push(`Invoices count when issued, paid or not: ₹${unpaid.toLocaleString("en-IN")} of these is still unpaid.`);
  }

  // Trainer pay: from payout runs marked paid (CASH) or from classes taught (EARNED).
  let trainerPay = 0;
  let trainerCount = 0;
  if (basis === "CASH") {
    const paid = await prisma.payoutItem.findMany({
      where: { status: "PAID", payoutRun: { paidAt: { gte: window.gte, lt: window.lt } } },
      select: { amount: true, payoutRun: { select: { paidAt: true } } },
    });
    for (const item of paid) {
      trainerPay += item.amount;
      trainerCount++;
      bump(istDate(item.payoutRun!.paidAt!), "trainerPay", item.amount);
    }
    const owed = await prisma.payoutItem.aggregate({
      where: { sessionDate: { gte: window.gte, lt: window.lt }, status: { not: "PAID" } },
      _sum: { amount: true },
      _count: true,
    });
    if (owed._count) {
      notes.push(
        `Trainer pay of ₹${(owed._sum.amount ?? 0).toLocaleString("en-IN")} for ${owed._count} class${owed._count === 1 ? "" : "es"} in this period is not marked paid in Trainer payouts, so it is not counted yet.`
      );
    }
  } else {
    const earned = await prisma.payoutItem.findMany({ where: { sessionDate: { gte: window.gte, lt: window.lt } }, select: { amount: true, sessionDate: true } });
    for (const item of earned) {
      trainerPay += item.amount;
      trainerCount++;
      bump(istDate(item.sessionDate), "trainerPay", item.amount);
    }
  }

  const expenseRows = await prisma.expense.findMany({ where: { spentOn: { gte: from, lte: to } }, orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }] });
  const byCategory = new Map<string, { amount: number; count: number }>();
  let expenses = 0;
  for (const e of expenseRows) {
    expenses += e.amount;
    bump(e.spentOn, "expenses", e.amount);
    const c = byCategory.get(e.category) ?? { amount: 0, count: 0 };
    byCategory.set(e.category, { amount: c.amount + e.amount, count: c.count + 1 });
  }

  const totalCosts = trainerPay + expenses;
  return {
    from,
    to,
    basis,
    income: { label: basis === "CASH" ? "Fees received" : "Fees invoiced", amount: income, count: incomeCount },
    trainerPay: { label: basis === "CASH" ? "Trainer pay paid out" : "Trainer pay for classes taught", amount: trainerPay, count: trainerCount },
    expenses: {
      amount: expenses,
      count: expenseRows.length,
      byCategory: [...byCategory.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount),
    },
    totalCosts,
    profit: income - totalCosts,
    months: [...months.entries()].map(([month, v]) => ({ month, label: monthLabel(month), ...v, profit: v.income - v.trainerPay - v.expenses })),
    otherCurrencies: [...other.entries()].map(([currency, v]) => ({ currency, ...v })),
    notes,
    sales: sales.reverse(),
    expenseRows: expenseRows.map((e) => ({ ...e, createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString() })),
  };
}
