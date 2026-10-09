import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, accounts, makeSubject, makeTeacher, makeStudent, enrol, makePackage, uid } from "./helpers";
import { calculatePackageBalances } from "../src/lib/package-calculations";
import { executeReallocation, validateReallocation } from "../src/lib/reallocation";
import { correctAttendanceRecord, submitSessionAttendance } from "../src/lib/attendance-ledger";
import { calculateStudentFinancialSummary, cancelInvoice, isPastDue, removeInvoice, verifyAndAllocatePayment } from "../src/lib/billing";
import { ApiError } from "../src/lib/api-errors";

async function pastSession(packageId: string, studentId: string, teacherId: string, subjectId: string, hoursAgo: number) {
  const start = new Date(Date.now() - hoursAgo * 3600 * 1000);
  return prisma.session.create({
    data: {
      packageId,
      studentId,
      teacherId,
      subjectId,
      scheduledStartTimeUtc: start,
      scheduledEndTimeUtc: new Date(start.getTime() + 3600 * 1000),
    },
  });
}

const complete = (sessionId: string, user = coordinator) =>
  submitSessionAttendance({
    sessionId,
    sessionOutcome: "COMPLETED",
    studentAttendance: "PRESENT",
    actualDurationMinutes: 60,
    topicCovered: "Lesson",
    user,
  });

async function packageScenario() {
  const chem = await makeSubject("Chemistry");
  const eng = await makeSubject("English");
  const chemTeacher = await makeTeacher("Chem Teacher");
  const engTeacher = await makeTeacher("Eng Teacher");
  const student = await makeStudent();
  await enrol(student.id, chem.id, chemTeacher.id);
  await enrol(student.id, eng.id, engTeacher.id);
  const pkg = await makePackage(student.id, [
    { subjectId: chem.id, credits: 10 },
    { subjectId: eng.id, credits: 10 },
  ]);
  return { chem, eng, chemTeacher, engTeacher, student, pkg };
}

describe("flexible package accounting", () => {
  test("20 classes 10/10, consume 6/4, reallocate 15/5 -> remaining 9/1, total 10; fees untouched", async () => {
    const { chem, eng, chemTeacher, engTeacher, student, pkg } = await packageScenario();
    const invoice = await prisma.invoice.create({
      data: { invoiceNumber: uid("INV-T"), studentId: student.id, packageId: pkg.id, dueDate: new Date(), subtotal: 18000, totalAmount: 18000, balanceDue: 18000 },
    });
    const completed: string[] = [];
    for (let i = 0; i < 6; i++) completed.push((await complete((await pastSession(pkg.id, student.id, chemTeacher.id, chem.id, 30 + i * 2)).id)).attendanceId);
    for (let i = 0; i < 4; i++) completed.push((await complete((await pastSession(pkg.id, student.id, engTeacher.id, eng.id, 60 + i * 2)).id)).attendanceId);

    await executeReallocation(pkg.id, [
      { subjectId: chem.id, newAllocatedCredits: 15 },
      { subjectId: eng.id, newAllocatedCredits: 5 },
    ], "Exam season booster", coordinator);

    const b = (await calculatePackageBalances(pkg.id))!;
    assert.equal(b.subjects.find((s) => s.subjectId === chem.id)!.remainingCredits, 9);
    assert.equal(b.subjects.find((s) => s.subjectId === eng.id)!.remainingCredits, 1);
    assert.equal(b.totalRemaining, 10);
    assert.equal(b.totalAllocated + b.unallocatedCredits, b.totalEntitlement);

    const records = await prisma.attendanceRecord.findMany({ where: { id: { in: completed } } });
    assert.ok(records.every((r) => r.sessionOutcome === "COMPLETED" && !r.isReversed), "completed attendance unchanged");
    const invoiceAfter = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(invoiceAfter.totalAmount, 18000, "reallocation does not alter fees");
  });

  test("allocations cannot drop below consumed, cannot exceed entitlement, and omitted subjects still count", async () => {
    const { chem, eng, chemTeacher, student, pkg } = await packageScenario();
    for (let i = 0; i < 4; i++) await complete((await pastSession(pkg.id, student.id, chemTeacher.id, chem.id, 10 + i * 2)).id);
    await assert.rejects(
      executeReallocation(pkg.id, [{ subjectId: chem.id, newAllocatedCredits: 3 }, { subjectId: eng.id, newAllocatedCredits: 17 }], "Too low", coordinator),
      /already been consumed/
    );
    // Before the fix, sending only Chemistry passed the total check while English kept its 10.
    await assert.rejects(
      executeReallocation(pkg.id, [{ subjectId: chem.id, newAllocatedCredits: 20 }], "Partial list", coordinator),
      /must exactly equal package entitlement/
    );
    await assert.rejects(
      executeReallocation(pkg.id, [{ subjectId: chem.id, newAllocatedCredits: 15 }, { subjectId: eng.id, newAllocatedCredits: 5 }], "Accounts tries", accounts),
      (e: ApiError) => e.status === 403
    );
  });

  test("reservations do not count as consumed, and excess future reservations block a reduction", async () => {
    const { eng, engTeacher, student, pkg } = await packageScenario();
    for (let d = 1; d <= 3; d++) {
      const start = new Date(Date.now() + d * 24 * 3600 * 1000);
      await prisma.session.create({
        data: { packageId: pkg.id, studentId: student.id, teacherId: engTeacher.id, subjectId: eng.id, scheduledStartTimeUtc: start, scheduledEndTimeUtc: new Date(start.getTime() + 3600 * 1000) },
      });
    }
    const b = (await calculatePackageBalances(pkg.id))!;
    assert.equal(b.totalConsumed, 0);
    assert.equal(b.totalReserved, 3);
    const v = await validateReallocation(pkg.id, [{ subjectId: eng.id, newAllocatedCredits: 2 }], null);
    assert.equal(v.valid, false);
    assert.equal(v.affectedSessions.length, 1, "the one excess future class is identified");
  });
});

describe("attendance", () => {
  test("duplicate and concurrent submissions consume one credit; a different outcome must use correction", async () => {
    const { chem, chemTeacher, student, pkg } = await packageScenario();
    const s = await pastSession(pkg.id, student.id, chemTeacher.id, chem.id, 5);
    const results = await Promise.all([complete(s.id), complete(s.id), complete(s.id)]);
    assert.equal(results.filter((r) => !r.alreadyProcessed).length, 1);
    assert.equal(await prisma.creditLedger.count({ where: { sessionId: s.id, eventType: "SESSION_CONSUMED" } }), 1);
    assert.equal(await prisma.payoutItem.count({ where: { sessionId: s.id } }), 1);
    await assert.rejects(
      submitSessionAttendance({ sessionId: s.id, sessionOutcome: "TEACHER_NO_SHOW", studentAttendance: "PRESENT", actualDurationMinutes: 0, topicCovered: "x", user: coordinator }),
      /Correct attendance/
    );
  });

  test("teacher absence consumes no credit", async () => {
    const { chem, chemTeacher, student, pkg } = await packageScenario();
    const s = await pastSession(pkg.id, student.id, chemTeacher.id, chem.id, 3);
    const r = await submitSessionAttendance({ sessionId: s.id, sessionOutcome: "TEACHER_NO_SHOW", studentAttendance: "PRESENT", actualDurationMinutes: 0, topicCovered: "Trainer unavailable", user: coordinator });
    assert.equal(r.shouldConsumeCredit, false);
    assert.equal((await calculatePackageBalances(pkg.id))!.totalConsumed, 0);
  });

  test("corrections need a coordinator, restore credit with history, and cancel the unpaid trainer payout", async () => {
    const { chem, chemTeacher, student, pkg } = await packageScenario();
    const s = await pastSession(pkg.id, student.id, chemTeacher.id, chem.id, 4);
    const { attendanceId } = await complete(s.id);
    await assert.rejects(correctAttendanceRecord(attendanceId, "TEACHER_NO_SHOW", "PRESENT", "Trainer did not join", accounts), (e: ApiError) => e.status === 403);
    const corrected = await correctAttendanceRecord(attendanceId, "TEACHER_NO_SHOW", "PRESENT", "Trainer did not join the class", coordinator);
    assert.equal(corrected.isReversed, true);
    assert.equal((await calculatePackageBalances(pkg.id))!.totalConsumed, 0, "credit restored");
    assert.equal(await prisma.attendanceRevision.count({ where: { attendanceRecordId: attendanceId } }), 1);
    const payout = await prisma.payoutItem.findUniqueOrThrow({ where: { sessionId: s.id } });
    assert.equal(payout.status, "CANCELLED", "trainer is not paid for a class that did not happen");
  });

  test("a correction after the payout was batched leaves the payout alone and warns", async () => {
    const { chem, chemTeacher, student, pkg } = await packageScenario();
    const s = await pastSession(pkg.id, student.id, chemTeacher.id, chem.id, 6);
    const { attendanceId } = await complete(s.id);
    const run = await prisma.payoutRun.create({ data: { runNumber: uid("PAYOUT-T"), periodStart: new Date(), periodEnd: new Date(), status: "APPROVED" } });
    await prisma.payoutItem.update({ where: { sessionId: s.id }, data: { payoutRunId: run.id } });
    const corrected = await correctAttendanceRecord(attendanceId, "STUDENT_NO_SHOW", "ABSENT", "Student never joined", coordinator);
    assert.equal(corrected.warnings.length, 1);
    assert.equal((await prisma.payoutItem.findUniqueOrThrow({ where: { sessionId: s.id } })).status, "APPROVED");
  });
});

describe("payments", () => {
  async function invoiceFor(studentId: string, amount: number, dueDate: Date) {
    return prisma.invoice.create({ data: { invoiceNumber: uid("INV-T"), studentId, dueDate, subtotal: amount, totalAmount: amount, balanceDue: amount } });
  }
  async function payment(studentId: string, amount: number, verified = false) {
    return prisma.payment.create({ data: { paymentNumber: uid("PAY-T"), studentId, amount, paymentMethod: "UPI", isVerified: verified } });
  }

  test("₹6,000 invoice with ₹2,000 verified payment shows ₹4,000 outstanding; proof alone changes nothing", async () => {
    const student = await makeStudent();
    const inv = await invoiceFor(student.id, 6000, new Date(Date.now() + 7 * 24 * 3600 * 1000));
    await payment(student.id, 4000); // proof uploaded, not verified
    assert.equal((await calculateStudentFinancialSummary(student.id)).outstanding, 6000);
    const pay = await payment(student.id, 2000);
    await verifyAndAllocatePayment({ paymentId: pay.id, invoiceId: inv.id, user: accounts });
    const summary = await calculateStudentFinancialSummary(student.id);
    assert.equal(summary.outstanding, 4000);
    assert.equal(summary.overdue, 0, "not overdue before the due date");
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status, "PARTIALLY_PAID");
  });

  test("overdue starts the day after the due date (IST), never on the due date", () => {
    const now = new Date("2026-10-07T10:00:00Z"); // 3:30 PM IST, 7 Oct
    assert.equal(isPastDue(new Date("2026-10-07T00:00:00Z"), now), false, "due today");
    assert.equal(isPastDue(new Date("2026-10-06T00:00:00Z"), now), true, "due yesterday");
    assert.equal(isPastDue(new Date("2026-10-20T00:00:00Z"), now), false, "future instalment");
  });

  test("a payment is verified and allocated only once, even when verified twice at the same time", async () => {
    const student = await makeStudent();
    const inv = await invoiceFor(student.id, 5000, new Date());
    const pay = await payment(student.id, 3000);
    const results = await Promise.allSettled([
      verifyAndAllocatePayment({ paymentId: pay.id, invoiceId: inv.id, user: accounts }),
      verifyAndAllocatePayment({ paymentId: pay.id, invoiceId: inv.id, user: owner }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    assert.equal(after.paidAmount, 3000);
    assert.equal(await prisma.paymentAllocation.count({ where: { paymentId: pay.id } }), 1);
  });

  test("a payment cannot be applied to another student's invoice; advances are not double counted", async () => {
    const a = await makeStudent();
    const b = await makeStudent();
    const invB = await invoiceFor(b.id, 1000, new Date());
    const payA = await payment(a.id, 1000);
    await assert.rejects(verifyAndAllocatePayment({ paymentId: payA.id, invoiceId: invB.id, user: accounts }), /different student/);
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: payA.id } })).isVerified, false, "rolled back");

    await verifyAndAllocatePayment({ paymentId: payA.id, user: accounts }); // verified as an advance
    const summary = await calculateStudentFinancialSummary(a.id);
    assert.equal(summary.verifiedPayments, 1000);
    assert.equal(summary.unallocatedAdvances, 1000);
    assert.equal(summary.outstanding, 0);
    await assert.rejects(verifyAndAllocatePayment({ paymentId: payA.id, user: accounts }), /already been verified/);
  });

  test("coordinators cannot verify payments", async () => {
    const student = await makeStudent();
    const pay = await payment(student.id, 500);
    await assert.rejects(verifyAndAllocatePayment({ paymentId: pay.id, user: coordinator }), (e: ApiError) => e.status === 403);
  });

  test("accounts or owner can remove unpaid invoices with no recorded payments", async () => {
    const student = await makeStudent();
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: uid("INV-DEL"),
        studentId: student.id,
        dueDate: new Date(),
        subtotal: 3000,
        totalAmount: 3000,
        paidAmount: 0,
        balanceDue: 3000,
        status: "UNPAID",
        items: { create: [{ description: "Package", quantity: 1, unitPrice: 3000, amount: 3000 }] },
      },
    });

    // Coordinators cannot delete invoices
    await assert.rejects(removeInvoice(inv.id, coordinator), (e: ApiError) => e.status === 403);

    // Accounts can remove the unpaid invoice
    const deleted = await removeInvoice(inv.id, accounts);
    assert.equal(deleted.id, inv.id);

    // Invoice and items are gone
    assert.equal(await prisma.invoice.findUnique({ where: { id: inv.id } }), null);
    assert.equal(await prisma.invoiceLineItem.count({ where: { invoiceId: inv.id } }), 0);

    // Audit log was recorded
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "INVOICE", entityId: inv.id, action: "DELETE_INVOICE" },
    });
    assert.ok(audit);
    assert.equal(audit.actorRole, "ACCOUNTS");
  });

  test("cannot remove an invoice that has payments recorded", async () => {
    const student = await makeStudent();
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: uid("INV-PAID"),
        studentId: student.id,
        dueDate: new Date(),
        subtotal: 3000,
        totalAmount: 3000,
        paidAmount: 1500,
        balanceDue: 1500,
        status: "PARTIALLY_PAID",
      },
    });

    await assert.rejects(removeInvoice(inv.id, owner), (e: ApiError) => e.status === 409);
  });

  test("accounts or owner can cancel an invoice", async () => {
    const student = await makeStudent();
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: uid("INV-CNC"),
        studentId: student.id,
        dueDate: new Date(),
        subtotal: 5000,
        totalAmount: 5000,
        paidAmount: 0,
        balanceDue: 5000,
        status: "UNPAID",
      },
    });

    // Coordinators cannot cancel invoices
    await assert.rejects(cancelInvoice(inv.id, coordinator), (e: ApiError) => e.status === 403);

    const cancelled = await cancelInvoice(inv.id, accounts, "Duplicate invoice");
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.balanceDue, 0);

    // Already cancelled invoice cannot be cancelled again
    await assert.rejects(cancelInvoice(inv.id, owner), (e: ApiError) => e.status === 409);
  });
});

