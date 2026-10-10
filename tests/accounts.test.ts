/**
 * Accounts: expenses (validation, permissions, audit, numbers never reused)
 * and profit & loss for a date range in IST, counted by money received and
 * paid or by invoices and classes taught. Uses a 2019 period no other test
 * touches, so every total is exact.
 */
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, accounts, makeSubject, makeTeacher, makeStudent, makePackage, uid } from "./helpers";
import { createExpense, deleteExpense, parseExpense, profitAndLoss, readRange, updateExpense } from "../src/lib/services/accounts";
import { quickRanges } from "../src/lib/accounts-shared";
import { nextCode } from "../src/lib/codes";
import { ApiError } from "../src/lib/api-errors";

const ist = (local: string) => new Date(`${local}+05:30`);
const rejectsWith = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof ApiError && e.status === status);
const expense = (extra: Record<string, unknown> = {}) => ({
  spentOn: "2019-01-15",
  category: "Rent",
  description: "January office rent",
  amount: 5000,
  paymentMethod: "BANK_TRANSFER",
  paidTo: "Fictional Landlord",
  ...extra,
});

describe("expenses", () => {
  test("only real dates, categories, methods and whole rupees are accepted", () => {
    const today = "2026-10-10";
    const fieldError = (body: Record<string, unknown>) => {
      try {
        parseExpense(body, today);
        return null;
      } catch (e) {
        return (e as ApiError).fieldErrors ?? {};
      }
    };
    assert.equal(fieldError(expense()), null);
    assert.ok(fieldError(expense({ spentOn: "2026-10-11" }))!.spentOn, "not in the future");
    assert.ok(fieldError(expense({ spentOn: "10/01/2019" }))!.spentOn);
    assert.ok(fieldError(expense({ category: "Salaries for trainers" }))!.category);
    assert.ok(fieldError(expense({ amount: 0 }))!.amount);
    assert.ok(fieldError(expense({ amount: 99.5 }))!.amount, "whole rupees");
    assert.ok(fieldError(expense({ amount: "abc" }))!.amount);
    assert.ok(fieldError(expense({ paymentMethod: "CHEQUE" }))!.paymentMethod);
    assert.ok(fieldError(expense({ description: "" }))!.description);
  });

  test("owner and Accounts can add, correct and delete; others cannot; every change is audited; numbers are never reused", async () => {
    await rejectsWith(createExpense(expense(), coordinator), 403);
    const e = await createExpense(expense({ spentOn: "2018-06-01", amount: 1234 }), accounts);
    assert.match(e.expenseNumber, /^EXP-\d{4}-\d{3,}$/);
    assert.equal(e.currency, "INR");
    assert.equal(e.createdByRole, "ACCOUNTS");
    await rejectsWith(updateExpense(e.id, expense({ amount: 1 }), coordinator), 403);
    const fixed = await updateExpense(e.id, expense({ spentOn: "2018-06-01", amount: 1243 }), owner);
    assert.equal(fixed.amount, 1243);
    const change = await prisma.auditLog.findFirstOrThrow({ where: { entityId: e.id, action: "UPDATE_EXPENSE" } });
    assert.deepEqual(JSON.parse(change.details).changes, { amount: { from: 1234, to: 1243 } });
    await rejectsWith(deleteExpense(e.id, coordinator), 403);
    await deleteExpense(e.id, accounts);
    assert.equal(await prisma.expense.count({ where: { id: e.id } }), 0);
    const removed = await prisma.auditLog.findFirstOrThrow({ where: { entityId: e.id, action: "DELETE_EXPENSE" } });
    assert.equal(JSON.parse(removed.details).amount, 1243, "the audit log keeps the deleted expense");
    assert.ok(Number((await nextCode(prisma, "expense")).split("-").pop()) > Number(e.expenseNumber.split("-").pop()), "its number is not issued again");
  });
});

describe("profit & loss", () => {
  const range = { from: "2019-01-01", to: "2019-02-28" };
  before(async () => {
    const subject = await makeSubject("PnL Maths");
    const teacher = await makeTeacher("PnL Trainer");
    const student = await makeStudent();
    const pkg = await makePackage(student.id, [{ subjectId: subject.id, credits: 10 }]);

    // Money in: verified ₹10,000 (one at 23:30 IST on 31 Jan), unverified ₹500, QAR 250; one just after the range in IST.
    const pay = (amount: number, at: string, extra: Record<string, unknown> = {}) =>
      prisma.payment.create({ data: { paymentNumber: uid("PAY-T"), studentId: student.id, amount, paymentMethod: "UPI", receivedDate: ist(at), isVerified: true, ...extra } });
    await pay(6000, "2019-01-10T10:00:00");
    await pay(4000, "2019-01-31T23:30:00");
    await pay(500, "2019-02-03T10:00:00", { isVerified: false });
    await pay(250, "2019-02-04T10:00:00", { currency: "QAR" });
    await pay(9999, "2019-03-01T00:10:00");
    // Invoices: ₹12,000 issued in January, ₹2,000 still unpaid; a cancelled one is ignored.
    await prisma.invoice.create({ data: { invoiceNumber: uid("INV-T"), studentId: student.id, subtotal: 12000, totalAmount: 12000, paidAmount: 10000, balanceDue: 2000, status: "PARTIALLY_PAID", issueDate: ist("2019-01-05T09:00:00"), dueDate: ist("2019-01-20T09:00:00") } });
    await prisma.invoice.create({ data: { invoiceNumber: uid("INV-T"), studentId: student.id, subtotal: 7000, totalAmount: 7000, balanceDue: 7000, status: "CANCELLED", issueDate: ist("2019-01-06T09:00:00"), dueDate: ist("2019-01-20T09:00:00") } });
    // Trainer pay: ₹3,000 for a class on 20 Jan, paid in a run on 5 Feb; ₹600 for 25 Jan not paid yet.
    const cls = async (date: string) => {
      const start = ist(`${date}T18:00:00`);
      return prisma.session.create({ data: { packageId: pkg.id, studentId: student.id, teacherId: teacher.id, subjectId: subject.id, scheduledStartTimeUtc: start, scheduledEndTimeUtc: new Date(start.getTime() + 3600000), status: "COMPLETED", isCreditConsumed: true } });
    };
    const run = await prisma.payoutRun.create({ data: { runNumber: uid("RUN-T"), periodStart: ist("2019-01-01T00:00:00"), periodEnd: ist("2019-01-31T00:00:00"), status: "PAID", paidAt: ist("2019-02-05T12:00:00") } });
    const s1 = await cls("2019-01-20");
    const s2 = await cls("2019-01-25");
    await prisma.payoutItem.create({ data: { teacherId: teacher.id, sessionId: s1.id, sessionDate: s1.scheduledStartTimeUtc, durationMinutes: 60, rateSnapshot: 3000, amount: 3000, status: "PAID", payoutRunId: run.id } });
    await prisma.payoutItem.create({ data: { teacherId: teacher.id, sessionId: s2.id, sessionDate: s2.scheduledStartTimeUtc, durationMinutes: 60, rateSnapshot: 600, amount: 600, status: "APPROVED" } });
    // Other expenses: ₹5,000 rent in January, ₹1,000 marketing in February, ₹777 outside the range.
    await createExpense(expense(), owner);
    await createExpense(expense({ spentOn: "2019-02-10", category: "Marketing & advertising", description: "Leaflets", amount: 1000, paymentMethod: "UPI" }), owner);
    await createExpense(expense({ spentOn: "2019-03-01", amount: 777 }), owner);
  });

  test("money received & paid: fees received minus trainer pay paid out and expenses, month by month in IST", async () => {
    const p = await profitAndLoss(owner, { ...range, basis: "CASH" });
    assert.deepEqual([p.income.amount, p.income.count], [10000, 2], "verified rupee payments only; 23:30 IST on 31 Jan is January; 00:10 IST on 1 Mar is not");
    assert.deepEqual([p.trainerPay.amount, p.trainerPay.count], [3000, 1], "paid out on 5 Feb");
    assert.equal(p.expenses.amount, 6000);
    assert.deepEqual(p.expenses.byCategory.map((c) => [c.category, c.amount]), [["Rent", 5000], ["Marketing & advertising", 1000]]);
    assert.equal(p.totalCosts, 9000);
    assert.equal(p.profit, 1000);
    assert.deepEqual(
      p.months.map((m) => [m.month, m.income, m.trainerPay, m.expenses, m.profit]),
      [["2019-01", 10000, 0, 5000, 5000], ["2019-02", 0, 3000, 1000, -4000]]
    );
    assert.deepEqual(p.otherCurrencies, [{ currency: "QAR", amount: 250, count: 1 }], "QAR is listed, never added to rupees");
    assert.match(p.notes.join(" "), /1 payment \(₹500\) recorded but not yet verified/);
    assert.match(p.notes.join(" "), /Trainer pay of ₹600 for 1 class .* not marked paid/);
    assert.equal(p.sales.length, 3, "two rupee payments and the QAR one");
  });

  test("invoices & classes taught: fees invoiced minus trainer pay for classes taught and expenses", async () => {
    const p = await profitAndLoss(owner, { ...range, basis: "EARNED" });
    assert.equal(p.income.amount, 12000, "the cancelled invoice is ignored");
    assert.equal(p.trainerPay.amount, 3600, "both classes taught in January, paid or not");
    assert.equal(p.expenses.amount, 6000);
    assert.equal(p.profit, 12000 - 3600 - 6000);
    assert.deepEqual(p.months.map((m) => m.profit), [12000 - 3600 - 5000, -1000]);
    assert.match(p.notes.join(" "), /₹2,000 of these is still unpaid/);
  });

  test("a loss shows as negative; one day works; only the owner and Accounts can see it", async () => {
    const p = await profitAndLoss(accounts, { from: "2019-02-10", to: "2019-02-10", basis: "CASH" });
    assert.equal(p.profit, -1000);
    assert.equal(p.months.length, 1);
    await rejectsWith(profitAndLoss(coordinator, { ...range, basis: "CASH" }), 403);
  });

  test("date ranges: defaults to this month, start must not be after end, at most 3 years", () => {
    assert.deepEqual(readRange(undefined, undefined, undefined, "2026-10-10"), { from: "2026-10-01", to: "2026-10-10", basis: "CASH" });
    assert.equal(readRange("2026-01-01", "2026-01-31", "EARNED").basis, "EARNED");
    assert.throws(() => readRange("2026-02-01", "2026-01-01", "CASH"), (e: unknown) => e instanceof ApiError && e.status === 400);
    assert.throws(() => readRange("2020-01-01", "2026-01-01", "CASH"), (e: unknown) => e instanceof ApiError && e.status === 400);
    const q = Object.fromEntries(quickRanges("2026-10-10").map((r) => [r.key, [r.from, r.to]]));
    assert.deepEqual(q["this-month"], ["2026-10-01", "2026-10-10"]);
    assert.deepEqual(q["last-month"], ["2026-09-01", "2026-09-30"]);
    assert.deepEqual(q["this-fy"], ["2026-04-01", "2026-10-10"], "Indian financial year from 1 April");
    assert.deepEqual(q["last-fy"], ["2025-04-01", "2026-03-31"]);
    assert.deepEqual(quickRanges("2026-02-15").find((r) => r.key === "this-fy")!.from, "2025-04-01");
  });
});
