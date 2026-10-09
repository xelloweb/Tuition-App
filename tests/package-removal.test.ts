/**
 * Owner-only removal of a wrongly created package (e.g. a "new package" made
 * for a student who had already paid): payments and attended classes stay,
 * booked classes and the unpaid invoice go.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, makeSubject, makeTeacher, makeStudent, makePackage, enrol, uid } from "./helpers";
import { previewPackageRemoval, removePackage } from "../src/lib/services/package-removal";
import { submitSessionAttendance } from "../src/lib/attendance-ledger";
import { calculatePackageBalances } from "../src/lib/package-calculations";
import { ApiError } from "../src/lib/api-errors";

async function status(p: Promise<unknown>) {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof ApiError) return e.status;
    throw e;
  }
}

/** A student who paid (original package + paid invoice + verified payment) and then got a wrong extra package. */
async function setup() {
  const subject = await makeSubject("Chemistry");
  const teacher = await makeTeacher("Removal Trainer");
  const student = await makeStudent();
  await enrol(student.id, subject.id, teacher.id);

  const original = await makePackage(student.id, [], { totalCredits: 12 }); // imported: paid, not yet allocated
  const paidInvoice = await prisma.invoice.create({
    data: { invoiceNumber: uid("INV-P"), studentId: student.id, packageId: original.id, subtotal: 6000, totalAmount: 6000, paidAmount: 6000, balanceDue: 0, status: "PAID", dueDate: new Date() },
  });
  const payment = await prisma.payment.create({
    data: { paymentNumber: uid("PAY"), studentId: student.id, amount: 6000, paymentMethod: "UPI", isVerified: true, verifiedAt: new Date(), allocations: { create: [{ invoiceId: paidInvoice.id, amount: 6000 }] } },
  });

  const wrong = await makePackage(student.id, [{ subjectId: subject.id, credits: 12 }]);
  const wrongInvoice = await prisma.invoice.create({
    data: { invoiceNumber: uid("INV-W"), studentId: student.id, packageId: wrong.id, subtotal: 6000, totalAmount: 6000, balanceDue: 6000, status: "UNPAID", dueDate: new Date() },
  });
  const booked = [];
  for (let d = 1; d <= 3; d++) {
    const start = new Date(Date.now() + d * 86400000);
    booked.push(
      await prisma.session.create({
        data: { packageId: wrong.id, studentId: student.id, teacherId: teacher.id, subjectId: subject.id, scheduledStartTimeUtc: start, scheduledEndTimeUtc: new Date(start.getTime() + 3600000) },
      })
    );
  }
  return { subject, teacher, student, original, paidInvoice, payment, wrong, wrongInvoice, booked };
}

async function attendOnWrongPackage(s: Awaited<ReturnType<typeof setup>>) {
  const start = new Date(Date.now() - 2 * 86400000);
  const session = await prisma.session.create({
    data: { packageId: s.wrong.id, studentId: s.student.id, teacherId: s.teacher.id, subjectId: s.subject.id, scheduledStartTimeUtc: start, scheduledEndTimeUtc: new Date(start.getTime() + 3600000) },
  });
  await submitSessionAttendance({ sessionId: session.id, sessionOutcome: "COMPLETED", studentAttendance: "PRESENT", actualDurationMinutes: 60, topicCovered: "Atoms", user: owner });
  return session;
}

describe("removing a wrongly created package", () => {
  test("removes the package, its unpaid invoice and booked classes; payments and the original package stay", async () => {
    const s = await setup();
    const paymentsBefore = await prisma.payment.findMany({ where: { studentId: s.student.id }, include: { allocations: true } });

    const preview = await previewPackageRemoval(s.wrong.id);
    assert.deepEqual(preview.blockers, []);
    assert.equal(preview.bookedClasses, 3);
    assert.deepEqual(preview.invoices.map((i) => i.invoiceNumber), [s.wrongInvoice.invoiceNumber]);

    const result = await removePackage(s.wrong.id, { confirmPackageNumber: s.wrong.packageNumber }, owner);
    assert.equal(result.bookedClassesRemoved, 3);

    assert.equal(await prisma.studentPackage.count({ where: { id: s.wrong.id } }), 0);
    assert.equal(await prisma.invoice.count({ where: { id: s.wrongInvoice.id } }), 0);
    assert.equal(await prisma.session.count({ where: { id: { in: s.booked.map((b) => b.id) } } }), 0);
    // Original payment, its invoice and the original package are exactly as before.
    assert.deepEqual(await prisma.payment.findMany({ where: { studentId: s.student.id }, include: { allocations: true } }), paymentsBefore);
    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: s.paidInvoice.id } });
    assert.equal(paid.paidAmount, 6000);
    assert.equal(paid.status, "PAID");
    assert.ok(await prisma.studentPackage.findUnique({ where: { id: s.original.id } }));
    // The trainer's classes no longer include the removed ones.
    assert.equal(await prisma.session.count({ where: { teacherId: s.teacher.id, packageId: s.wrong.id } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { action: "REMOVE_WRONG_PACKAGE", entityId: s.wrong.id } }), 1);
  });

  test("attended classes are never deleted: removal waits for the correct package, then moves them", async () => {
    const s = await setup();
    const attended = await attendOnWrongPackage(s);
    const attendanceBefore = await prisma.attendanceRecord.findUniqueOrThrow({ where: { sessionId: attended.id } });

    const blocked = await previewPackageRemoval(s.wrong.id);
    assert.equal(blocked.attendedClasses.length, 1);
    assert.match(blocked.blockers.join(" "), /Set up the correct package first/);
    assert.equal(await status(removePackage(s.wrong.id, { confirmPackageNumber: s.wrong.packageNumber }, owner)), 409);
    assert.ok(await prisma.studentPackage.findUnique({ where: { id: s.wrong.id } }), "nothing removed while blocked");

    // The correct package (as "Assign package using existing payment" would give it) can take the class.
    const correct = await makePackage(s.student.id, [{ subjectId: s.subject.id, credits: 12 }]);
    const ready = await previewPackageRemoval(s.wrong.id);
    assert.deepEqual(ready.moveTargets.map((t) => t.id), [correct.id]);
    assert.equal(await status(removePackage(s.wrong.id, { confirmPackageNumber: s.wrong.packageNumber }, owner)), 400, "must choose where the attended class goes");

    await removePackage(s.wrong.id, { confirmPackageNumber: s.wrong.packageNumber, moveAttendedTo: correct.id }, owner);
    const moved = await prisma.session.findUniqueOrThrow({ where: { id: attended.id }, include: { attendance: true } });
    assert.equal(moved.packageId, correct.id);
    assert.deepEqual(moved.attendance, attendanceBefore, "attendance itself is unchanged");
    assert.equal(await prisma.creditLedger.count({ where: { sessionId: attended.id, packageId: correct.id, eventType: "SESSION_CONSUMED" } }), 1);
    const balance = await calculatePackageBalances(correct.id);
    assert.equal(balance?.totalConsumed, 1, "the attended class counts against the correct package");
    assert.equal(await prisma.studentPackage.count({ where: { id: s.wrong.id } }), 0);
  });

  test("a package holding a payment cannot be removed", async () => {
    const s = await setup();
    const preview = await previewPackageRemoval(s.original.id);
    assert.match(preview.blockers.join(" "), /holds a real payment/);
    assert.equal(await status(removePackage(s.original.id, { confirmPackageNumber: s.original.packageNumber }, owner)), 409);
    assert.ok(await prisma.studentPackage.findUnique({ where: { id: s.original.id } }));
  });

  test("owner only, and the package number must be typed", async () => {
    const s = await setup();
    assert.equal(await status(removePackage(s.wrong.id, { confirmPackageNumber: s.wrong.packageNumber }, coordinator)), 403);
    assert.equal(await status(removePackage(s.wrong.id, { confirmPackageNumber: "PKG-WRONG" }, owner)), 400);
    assert.ok(await prisma.studentPackage.findUnique({ where: { id: s.wrong.id } }));
  });
});
