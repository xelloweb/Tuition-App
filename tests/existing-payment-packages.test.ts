/**
 * "Assign package using existing payment": money already paid becomes a working
 * package without any new payment; totals, receipts and reports do not change.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, accounts, makeSubject, uid } from "./helpers";
import { assignPackageFromExistingPayment, existingPaymentOptions, studentsNeedingPackageSetup } from "../src/lib/services/existing-payment-packages";
import { createPackageForStudent, updateStudent } from "../src/lib/services/students";
import { calculateFinancialSummary, calculateStudentFinancialSummary } from "../src/lib/billing";
import { calculatePackageBalances } from "../src/lib/package-calculations";
import { ApiError } from "../src/lib/api-errors";

const today = () => new Date().toISOString().slice(0, 10);

async function legacyStudent(subjectNames: string[] = ["Maths"]) {
  const subjects = await Promise.all(subjectNames.map((n) => makeSubject(n)));
  const student = await prisma.student.create({
    data: {
      studentCode: uid("STU").slice(0, 30),
      name: `Legacy Student ${uid("l")}`,
      grade: "8th Grade",
      guardianName: "Fictional Parent",
      whatsappNumber: "+91 98470 33333",
      enrolments: { create: subjects.map((s) => ({ subjectId: s.id, status: "ACTIVE" })) },
    },
  });
  return { student, subjects };
}

async function payment(studentId: string, amount: number, verified = true) {
  return prisma.payment.create({
    data: { paymentNumber: uid("PAY"), studentId, amount, paymentMethod: "UPI", isVerified: verified, verifiedAt: verified ? new Date() : null },
  });
}

async function moneyCounts(studentId: string) {
  const [payments, paymentSum, invoices] = await Promise.all([
    prisma.payment.count({ where: { studentId } }),
    prisma.payment.aggregate({ where: { studentId }, _sum: { amount: true } }),
    prisma.invoice.count({ where: { studentId } }),
  ]);
  return { payments, paid: paymentSum._sum.amount ?? 0, invoices };
}

const twelveClasses = (subjectId: string, extra: Record<string, unknown> = {}) => ({
  source: { type: "PAYMENTS" },
  name: "Monthly Package (3 Classes/week)",
  totalCredits: 12,
  price: 3000,
  startDate: today(),
  allocations: [{ subjectId, allocatedCredits: 12 }],
  ...extra,
});

async function expectApiError(promise: Promise<unknown>, status: number, pattern?: RegExp) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof ApiError, String(err));
    assert.equal(err.status, status, err.message);
    if (pattern) assert.match(err.message, pattern);
    return true;
  });
}

describe("assign package using an existing payment", () => {
  test("the brief's example: ₹3,000 already paid becomes Monthly 12 Classes with no new payment", async () => {
    const { student, subjects } = await legacyStudent();
    const pay = await payment(student.id, 3000);
    const before = await moneyCounts(student.id);
    const receivedBefore = (await calculateFinancialSummary()).received;

    const result = await assignPackageFromExistingPayment(student.id, twelveClasses(subjects[0].id), owner);
    assert.equal(result.packageValue, 3000);
    assert.equal(result.paidFromExisting, 3000);
    assert.equal(result.stillToPay, 0);
    assert.equal(result.newPaymentCreated, 0);

    const after = await moneyCounts(student.id);
    assert.equal(after.payments, before.payments, "no payment created");
    assert.equal(after.paid, before.paid, "total paid unchanged");
    assert.equal((await calculateFinancialSummary()).received, receivedBefore, "dashboard receipts unchanged");

    const balances = await calculatePackageBalances(result.packageId);
    assert.equal(balances!.status, "ACTIVE");
    assert.equal(balances!.totalEntitlement, 12);
    assert.equal(balances!.totalAvailable, 12, "balance classes 12");
    assert.equal(balances!.totalConsumed, 0);
    assert.equal(balances!.unallocatedCredits, 0);

    const invoice = await prisma.invoice.findFirstOrThrow({ where: { packageId: result.packageId }, include: { allocations: true } });
    assert.equal(invoice.status, "PAID");
    assert.equal(invoice.paidAmount, 3000);
    assert.equal(invoice.balanceDue, 0);
    assert.deepEqual(invoice.allocations.map((a) => [a.paymentId, a.amount]), [[pay.id, 3000]], "the existing payment is linked");

    const summary = await calculateStudentFinancialSummary(student.id);
    assert.equal(summary.verifiedPayments, 3000);
    assert.equal(summary.outstanding, 0);
    assert.equal(summary.unallocatedAdvances, 0);

    const ledger = await prisma.creditLedger.findMany({ where: { packageId: result.packageId } });
    assert.equal(ledger.length, 1);
    assert.match(ledger[0].reason, /existing payment/);
    assert.equal(await prisma.auditLog.count({ where: { entityId: result.packageId, action: "ASSIGN_PACKAGE_FROM_EXISTING_PAYMENT" } }), 1);

    await expectApiError(assignPackageFromExistingPayment(student.id, twelveClasses(subjects[0].id), owner), 409, /no verified payment left/);
    assert.equal((await moneyCounts(student.id)).payments, before.payments, "the payment cannot be used twice");
  });

  test("an imported paid package without subjects is set up in place: no new package, invoice or payment", async () => {
    const { student, subjects } = await legacyStudent(["Physics", "Chemistry"]);
    const pkg = await prisma.studentPackage.create({
      data: { packageNumber: uid("PKG"), studentId: student.id, name: "Monthly Package (3 Classes/week)", totalCredits: 12, price: 3000, status: "ACTIVE" },
    });
    const invoice = await prisma.invoice.create({
      data: { invoiceNumber: uid("INV"), studentId: student.id, packageId: pkg.id, dueDate: new Date(), subtotal: 3000, totalAmount: 3000, paidAmount: 3000, balanceDue: 0, status: "PAID" },
    });
    const pay = await payment(student.id, 3000);
    await prisma.paymentAllocation.create({ data: { paymentId: pay.id, invoiceId: invoice.id, amount: 3000 } });
    const options = await existingPaymentOptions(student.id);
    assert.equal(options!.unsetPackages.length, 1);
    assert.equal(options!.unsetPackages[0].paid, 3000);
    const before = await moneyCounts(student.id);
    const packagesBefore = await prisma.studentPackage.count({ where: { studentId: student.id } });

    const result = await assignPackageFromExistingPayment(
      student.id,
      { source: { type: "PACKAGE", id: pkg.id }, totalCredits: 12, startDate: today(), allocations: [{ subjectId: subjects[0].id, allocatedCredits: 6 }, { subjectId: subjects[1].id, allocatedCredits: 6 }] },
      owner
    );
    assert.equal(result.packageId, pkg.id);
    assert.equal(result.paidFromExisting, 3000);
    assert.deepEqual(await moneyCounts(student.id), before);
    assert.equal(await prisma.studentPackage.count({ where: { studentId: student.id } }), packagesBefore);
    const balances = await calculatePackageBalances(pkg.id);
    assert.deepEqual(balances!.subjects.map((s) => s.allocatedCredits).sort(), [6, 6]);
    assert.equal((await existingPaymentOptions(student.id))!.unsetPackages.length, 0, "no longer listed");
    await expectApiError(
      assignPackageFromExistingPayment(student.id, { source: { type: "PACKAGE", id: pkg.id }, totalCredits: 12, startDate: today(), allocations: [{ subjectId: subjects[0].id, allocatedCredits: 12 }] }, owner),
      409,
      /already set up/
    );
  });

  test("a paid invoice without a package is linked to the new package: no new invoice or payment", async () => {
    const { student, subjects } = await legacyStudent();
    const invoice = await prisma.invoice.create({
      data: { invoiceNumber: uid("INV"), studentId: student.id, dueDate: new Date(), subtotal: 4000, totalAmount: 4000, paidAmount: 4000, balanceDue: 0, status: "PAID" },
    });
    const pay = await payment(student.id, 4000);
    await prisma.paymentAllocation.create({ data: { paymentId: pay.id, invoiceId: invoice.id, amount: 4000 } });
    const before = await moneyCounts(student.id);
    const result = await assignPackageFromExistingPayment(
      student.id,
      { source: { type: "INVOICE", id: invoice.id }, totalCredits: 16, startDate: today(), allocations: [{ subjectId: subjects[0].id, allocatedCredits: 16 }] },
      owner
    );
    assert.equal(result.packageValue, 4000);
    assert.equal(result.invoiceNumber, invoice.invoiceNumber);
    assert.deepEqual(await moneyCounts(student.id), before);
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).packageId, result.packageId);
    assert.equal((await prisma.studentPackage.findUniqueOrThrow({ where: { id: result.packageId } })).price, 4000);
  });

  test("less paid than the package value: the rest is shown as still to pay; more paid: the rest stays as advance", async () => {
    const { student, subjects } = await legacyStudent();
    await payment(student.id, 2000);
    const partial = await assignPackageFromExistingPayment(student.id, twelveClasses(subjects[0].id), owner);
    assert.equal(partial.paidFromExisting, 2000);
    assert.equal(partial.stillToPay, 1000);
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { packageId: partial.packageId } });
    assert.equal(invoice.status, "PARTIALLY_PAID");
    assert.equal(invoice.balanceDue, 1000);

    const other = await legacyStudent();
    await payment(other.student.id, 5000);
    const result = await assignPackageFromExistingPayment(other.student.id, twelveClasses(other.subjects[0].id), owner);
    assert.equal(result.paidFromExisting, 3000);
    assert.equal((await calculateStudentFinancialSummary(other.student.id)).unallocatedAdvances, 2000);
  });

  test("unverified payments, missing subjects and wrong class splits are refused", async () => {
    const { student, subjects } = await legacyStudent();
    await payment(student.id, 3000, false);
    await expectApiError(assignPackageFromExistingPayment(student.id, twelveClasses(subjects[0].id), owner), 409, /no verified payment/);
    assert.equal((await existingPaymentOptions(student.id))!.unverifiedTotal, 3000);

    await payment(student.id, 3000);
    await expectApiError(assignPackageFromExistingPayment(student.id, twelveClasses(subjects[0].id, { allocations: [{ subjectId: subjects[0].id, allocatedCredits: 10 }] }), owner), 400);
    const elsewhere = await makeSubject("Not enrolled");
    await expectApiError(assignPackageFromExistingPayment(student.id, twelveClasses(elsewhere.id), owner), 400, /current subjects/);

    const bare = await prisma.student.create({
      data: { studentCode: uid("STU").slice(0, 30), name: "No Subjects Yet", grade: "5th Grade", guardianName: "Fictional Parent", whatsappNumber: "+91 98470 44444" },
    });
    await payment(bare.id, 3000);
    await expectApiError(assignPackageFromExistingPayment(bare.id, twelveClasses(subjects[0].id), owner), 400, /subjects first/);
  });

  test("two people assigning from the same payment at once: it is used only once", async () => {
    const { student, subjects } = await legacyStudent();
    const pay = await payment(student.id, 3000);
    const results = await Promise.allSettled([
      assignPackageFromExistingPayment(student.id, twelveClasses(subjects[0].id), owner),
      assignPackageFromExistingPayment(student.id, twelveClasses(subjects[0].id), owner),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const used = await prisma.paymentAllocation.aggregate({ where: { paymentId: pay.id }, _sum: { amount: true } });
    assert.equal(used._sum.amount, 3000);
    assert.equal(await prisma.studentPackage.count({ where: { studentId: student.id } }), 1);
  });

  test("students with paid money but no working package are listed for the owner", async () => {
    const { student } = await legacyStudent();
    await payment(student.id, 1500);
    const list = await studentsNeedingPackageSetup();
    const row = list.find((s) => s.id === student.id);
    assert.ok(row);
    assert.deepEqual(row!.reasons, ["Unused payment"]);
  });

  test("buying a new package still creates a new invoice to collect (unchanged)", async () => {
    const { student, subjects } = await legacyStudent();
    const created = await prisma.$transaction((tx) =>
      createPackageForStudent(tx, student.id, { name: "Top-up", totalCredits: 4, price: 1000, startDate: new Date(), expiryDate: null, allocations: [{ subjectId: subjects[0].id, allocatedCredits: 4 }] }, owner)
    );
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { packageId: created.packageId } });
    assert.equal(invoice.status, "UNPAID");
    assert.equal(invoice.balanceDue, 1000);
  });

  test("coordinator and accounts can assign packages from existing payment", async () => {
    const { student: s1, subjects: sub1 } = await legacyStudent();
    await payment(s1.id, 3000);
    const resCoord = await assignPackageFromExistingPayment(s1.id, twelveClasses(sub1[0].id), coordinator);
    assert.equal(resCoord.paidFromExisting, 3000);
    assert.equal(resCoord.newPaymentCreated, 0);

    const { student: s2, subjects: sub2 } = await legacyStudent();
    await payment(s2.id, 3000);
    const resAccounts = await assignPackageFromExistingPayment(s2.id, twelveClasses(sub2[0].id), accounts);
    assert.equal(resAccounts.paidFromExisting, 3000);
    assert.equal(resAccounts.newPaymentCreated, 0);
  });

  test("updateStudent with assignFromExistingPayment links existing payment, creates ₹0 new payment and tracks package normally", async () => {
    const { student, subjects } = await legacyStudent();
    // Existing record: Payment Received = ₹3,000, Package = Not Assigned
    await payment(student.id, 3000);

    const beforeMoney = await moneyCounts(student.id);
    assert.equal(beforeMoney.payments, 1);
    assert.equal(beforeMoney.paid, 3000);

    // Admin selects Assign Package Using Existing Payment
    const res = await updateStudent(
      student.id,
      {
        name: student.name,
        newPackage: {
          assignFromExistingPayment: true,
          name: "Monthly 12 Classes Package",
          totalCredits: 12,
          price: 3000,
          startDate: new Date(),
          expiryDate: null,
          allocations: [{ subjectId: subjects[0].id, allocatedCredits: 12 }],
        },
      },
      coordinator
    );

    assert.ok(res.packageNumber);

    // After assignment:
    // 1. Total payments unchanged (0 new payments created)
    const afterMoney = await moneyCounts(student.id);
    assert.equal(afterMoney.payments, 1);
    assert.equal(afterMoney.paid, 3000);

    // 2. Package appears in student profile as an active package
    const pkg = await prisma.studentPackage.findFirstOrThrow({
      where: { studentId: student.id, status: "ACTIVE" },
      include: { allocations: true },
    });
    assert.equal(pkg.totalCredits, 12);
    assert.equal(pkg.allocations.length, 1);
    assert.equal(pkg.allocations[0].allocatedCredits, 12);

    // 3. Package details tracked normally
    const balance = await calculatePackageBalances(pkg.id);
    assert.ok(balance);
    assert.equal(balance!.totalEntitlement, 12);
    assert.equal(balance!.totalConsumed, 0);
    assert.equal(balance!.totalRemaining, 12);
    assert.equal(balance!.price, 3000);
    assert.equal(balance!.paidAmount, 3000);
    assert.equal(balance!.balanceDue, 0);

    // 4. Financial summary: total collected remains unchanged (no duplicate payment)
    const fin = await calculateStudentFinancialSummary(student.id);
    assert.equal(fin.verifiedPayments, 3000);
    assert.equal(fin.netBilled, 3000);
    assert.equal(fin.outstanding, 0);
    assert.equal(fin.unallocatedAdvances, 0);
    assert.equal(fin.paymentsCount, 1);
  });
});
