/**
 * Removing packages created automatically from payment records (the 8 Oct
 * import and the edit form's automatic "assign from existing payment"):
 * only proven ones go, payments never change, packages staff set up stay,
 * and the freed money is ready for "Assign Package Using Existing Payment".
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, makeSubject, makeTeacher, uid } from "./helpers";
import {
  AutoPackageBackup,
  buildAutoPackageBackup,
  removeAutoPackages,
  restoreAutoPackageBackup,
  reviewAutoPackages,
} from "../src/lib/services/auto-package-cleanup";
import { assignPackageFromExistingPayment, existingPaymentOptions } from "../src/lib/services/existing-payment-packages";
import { createStudent, parseStudentFields, updateStudent } from "../src/lib/services/students";
import { recordManualAttendance } from "../src/lib/services/manual-attendance";
import { nextCode } from "../src/lib/codes";
import { ApiError } from "../src/lib/api-errors";
import { CurrentUser } from "../src/lib/types";

const istDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const today = () => istDate(new Date());

/** Every payment and payment link in the database, to prove nothing about money changed. */
const paymentsSnapshot = async () =>
  JSON.stringify(await prisma.payment.findMany({ orderBy: { id: "asc" }, select: { id: true, paymentNumber: true, amount: true, isVerified: true, receivedDate: true, studentId: true } }));

async function studentWithSubject(code = `XEL-${uid("imp")}`) {
  const subject = await makeSubject("Auto Maths");
  const teacher = await makeTeacher("Auto Trainer");
  const student = await prisma.student.create({
    data: {
      studentCode: code,
      name: `Auto Student ${uid("a")}`,
      grade: "8th Grade",
      guardianName: "Fictional Parent",
      whatsappNumber: "+91 98470 44444",
      enrolments: { create: [{ subjectId: subject.id, teacherId: teacher.id, status: "ACTIVE" }] },
    },
    include: { enrolments: true },
  });
  return { student, subject, teacher, enrolment: student.enrolments[0] };
}

/** What the 8 Oct import made for each student: a package, a paid invoice and a verified payment. */
async function importedStudent() {
  const s = await studentWithSubject();
  const code = s.student.studentCode;
  const pkg = await prisma.studentPackage.create({
    data: { packageNumber: `PKG-${code}`, studentId: s.student.id, name: "Monthly (12 hrs)", totalCredits: 12, price: 3000, status: "ACTIVE", notes: "Starting date: April 2026, Schedule: Mon 6 PM" },
  });
  const invoice = await prisma.invoice.create({
    data: { invoiceNumber: `INV-${code}`, studentId: s.student.id, packageId: pkg.id, subtotal: 3000, totalAmount: 3000, paidAmount: 3000, balanceDue: 0, status: "PAID", dueDate: new Date(), notes: "Paid via Demo Admission: ₹3000" },
  });
  const payment = await prisma.payment.create({
    data: { paymentNumber: `PAY-${code}`, studentId: s.student.id, amount: 3000, paymentMethod: "BANK_TRANSFER", reference: `DEMO-CONV-${code}`, isVerified: true, verifiedAt: new Date() },
  });
  await prisma.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: invoice.id, amount: 3000 } });
  return { ...s, pkg, invoice, payment };
}

/** A weekly slot, so assigning a package books classes on it. */
async function weeklySlot(enrolmentId: string, teacherId: string) {
  const day = new Date(`${istDate(new Date(Date.now() + 3 * 86400000))}T12:00:00+05:30`).getUTCDay();
  return prisma.timetableSlot.create({
    data: { enrolmentId, teacherId, weekday: day, startMinutes: 18 * 60, endMinutes: 19 * 60, timeZone: "Asia/Kolkata", effectiveFrom: new Date(Date.now() - 86400000), createdByName: "test", createdByRole: "OWNER" },
  });
}

/** What saving the old Edit Student form did by itself: assign a package from the existing payment. */
async function editFormAssign(studentId: string, subjectId: string, source: Record<string, unknown>) {
  return updateStudent(
    studentId,
    {
      learningGoals: "Edited for another reason",
      newPackage: {
        assignFromExistingPayment: true,
        source,
        name: "Monthly Package (3 Classes/week)",
        totalCredits: 12,
        price: 4000,
        startDate: new Date(),
        expiryDate: null,
        allocations: [{ subjectId, allocatedCredits: 12 }],
      },
    },
    coordinator
  );
}

const find = (review: Awaited<ReturnType<typeof reviewAutoPackages>>, packageId: string) =>
  [...review.removable, ...review.kept].find((p) => p.packageId === packageId);

describe("automatically created packages", () => {
  test("an imported package is removed; its paid invoice and payment stay and are ready to assign", async () => {
    const s = await importedStudent();
    const money = await paymentsSnapshot();
    const item = find(await reviewAutoPackages(), s.pkg.id)!;
    assert.equal(item.origin, "IMPORT");
    assert.equal(item.keepReason, null);
    assert.deepEqual(item.invoice, { invoiceNumber: s.invoice.invoiceNumber, action: "UNLINK", paidAmount: 3000 });
    assert.equal(item.onlyPackage, true);

    const res = await removeAutoPackages({ confirm: "remove" }, owner);
    assert.ok(res.removed >= 1);
    assert.equal(await prisma.studentPackage.count({ where: { id: s.pkg.id } }), 0);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoice.id } });
    assert.equal(invoice.packageId, null, "unlinked, not deleted");
    assert.deepEqual([invoice.paidAmount, invoice.balanceDue, invoice.status], [3000, 0, "PAID"]);
    assert.equal(await prisma.paymentAllocation.count({ where: { invoiceId: s.invoice.id, paymentId: s.payment.id } }), 1);
    assert.equal(await paymentsSnapshot(), money, "payments unchanged");
    assert.equal(await prisma.studentPackage.count({ where: { studentId: s.student.id } }), 0, "No Active Package");

    // Staff then assign the right package from that invoice: no new payment.
    const options = (await existingPaymentOptions(s.student.id))!;
    assert.deepEqual(options.unlinkedInvoices.map((i) => i.invoiceNumber), [s.invoice.invoiceNumber]);
    const assigned = await assignPackageFromExistingPayment(
      s.student.id,
      { source: { type: "INVOICE", id: s.invoice.id }, name: "Correct package", totalCredits: 8, startDate: today(), allocations: [{ subjectId: s.subject.id, allocatedCredits: 8 }] },
      coordinator
    );
    assert.equal(assigned.newPaymentCreated, 0);
    assert.equal(await paymentsSnapshot(), money);
    assert.equal(find(await reviewAutoPackages(), assigned.packageId), undefined, "a package staff assigned is never listed");
  });

  test("a package the edit form created from payments is removed with its invoice and booked classes; the payment is unused again", async () => {
    const s = await studentWithSubject(uid("STU"));
    await weeklySlot(s.enrolment.id, s.teacher.id);
    const pay = await prisma.payment.create({ data: { paymentNumber: await nextCode(prisma, "payment"), studentId: s.student.id, amount: 4000, paymentMethod: "UPI", isVerified: true, verifiedAt: new Date() } });
    const money = await paymentsSnapshot();
    const edit = await editFormAssign(s.student.id, s.subject.id, { type: "PAYMENTS" });
    const pkg = await prisma.studentPackage.findFirstOrThrow({ where: { studentId: s.student.id }, include: { invoices: true } });
    assert.equal(edit.packageNumber, pkg.packageNumber);
    const booked = await prisma.session.count({ where: { packageId: pkg.id } });
    assert.ok(booked >= 1, "the slot booked classes on it");

    const item = find(await reviewAutoPackages(), pkg.id)!;
    assert.equal(item.origin, "EDIT_FORM");
    assert.equal(item.invoice?.action, "REMOVE");
    assert.equal(item.bookedClasses, booked);

    await removeAutoPackages({ confirm: "REMOVE" }, owner);
    assert.equal(await prisma.studentPackage.count({ where: { id: pkg.id } }), 0);
    assert.equal(await prisma.invoice.count({ where: { id: pkg.invoices[0].id } }), 0, "the form's invoice is gone");
    assert.equal(await prisma.session.count({ where: { studentId: s.student.id } }), 0, "booked classes removed");
    assert.equal(await prisma.timetableSlot.count({ where: { enrolmentId: s.enrolment.id } }), 1, "the weekly timetable stays");
    assert.equal(await paymentsSnapshot(), money, "payment unchanged");
    assert.equal((await existingPaymentOptions(s.student.id))!.unusedTotal, pay.amount, "the whole payment is free to assign again");
    // Its numbers are never issued again.
    assert.ok(Number((await nextCode(prisma, "package")).split("-").pop()) > Number(pkg.packageNumber.split("-").pop()));
    assert.ok(Number((await nextCode(prisma, "invoice")).split("-").pop()) > Number(pkg.invoices[0].invoiceNumber.split("-").pop()));
  });

  test("a package the edit form linked to a paid invoice is removed and the invoice unlinked", async () => {
    const s = await studentWithSubject(uid("STU"));
    const invoice = await prisma.invoice.create({ data: { invoiceNumber: uid("INV-T"), studentId: s.student.id, subtotal: 3000, totalAmount: 3000, paidAmount: 3000, balanceDue: 0, status: "PAID", dueDate: new Date() } });
    const pay = await prisma.payment.create({ data: { paymentNumber: uid("PAY-T"), studentId: s.student.id, amount: 3000, paymentMethod: "UPI", isVerified: true } });
    await prisma.paymentAllocation.create({ data: { paymentId: pay.id, invoiceId: invoice.id, amount: 3000 } });
    await editFormAssign(s.student.id, s.subject.id, { type: "INVOICE", id: invoice.id });
    const pkg = await prisma.studentPackage.findFirstOrThrow({ where: { studentId: s.student.id } });
    assert.equal(find(await reviewAutoPackages(), pkg.id)?.invoice?.action, "UNLINK");
    await removeAutoPackages({ confirm: "REMOVE" }, owner);
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).packageId, null);
    assert.equal(await prisma.paymentAllocation.count({ where: { invoiceId: invoice.id } }), 1);
  });

  test("kept: set up with the Assign button, changed with Edit Package, or with attended classes; never listed: normal packages", async () => {
    // Set up in place by staff with the button.
    const viaButton = await importedStudent();
    await assignPackageFromExistingPayment(
      viaButton.student.id,
      { source: { type: "PACKAGE", id: viaButton.pkg.id }, totalCredits: 12, startDate: today(), allocations: [{ subjectId: viaButton.subject.id, allocatedCredits: 12 }] },
      coordinator
    );
    // Edited by staff with Edit Package (its audit entry, as editStudentPackage writes it).
    const edited = await importedStudent();
    await prisma.auditLog.create({ data: { entityType: "PACKAGE", entityId: edited.pkg.id, action: "EDIT_PACKAGE", actorRole: "COORDINATOR", actorName: "Coordinator", details: "{}" } });
    // Created by the edit form, then a class was attended on it.
    const attended = await studentWithSubject(uid("STU"));
    await prisma.payment.create({ data: { paymentNumber: uid("PAY-T"), studentId: attended.student.id, amount: 4000, paymentMethod: "UPI", isVerified: true } });
    await editFormAssign(attended.student.id, attended.subject.id, { type: "PAYMENTS" });
    const trainer: CurrentUser = { id: uid("u"), name: attended.teacher.name, email: attended.teacher.email, role: "TEACHER", teacherId: attended.teacher.id };
    await recordManualAttendance({ studentId: attended.student.id, subjectId: attended.subject.id, classDate: istDate(new Date(Date.now() - 86400000)), durationMinutes: 60, topicCovered: "Fractions" }, trainer);
    const attendedPkg = await prisma.studentPackage.findFirstOrThrow({ where: { studentId: attended.student.id } });
    // Looks imported but its invoice was changed: origin not confirmed.
    const changed = await importedStudent();
    await prisma.invoice.update({ where: { id: changed.invoice.id }, data: { notes: "Edited by accounts" } });
    // A normal admission package.
    const normal = await createStudent(
      parseStudentFields({ name: uid("Normal"), grade: "8th Grade", guardianName: "Fictional Parent", whatsappNumber: "+971 501112233", country: "UAE", enrolments: [{ subjectId: attended.subject.id, teacherId: null }], initialPackage: { totalCredits: 12, price: 3000, startDate: today(), allocations: [{ subjectId: attended.subject.id, allocatedCredits: 12 }] } }, { partial: false }),
      coordinator,
      uid("idem")
    );
    const normalPkg = await prisma.studentPackage.findFirstOrThrow({ where: { studentId: normal.result.id } });

    const review = await reviewAutoPackages();
    assert.match(find(review, viaButton.pkg.id)!.keepReason!, /Assign Package Using Existing Payment/);
    assert.match(find(review, edited.pkg.id)!.keepReason!, /Edit Package/);
    assert.match(find(review, attendedPkg.id)!.keepReason!, /1 attended class/);
    assert.match(find(review, changed.pkg.id)!.keepReason!, /cannot be confirmed/);
    assert.equal(find(review, normalPkg.id), undefined);

    const money = await paymentsSnapshot();
    await removeAutoPackages({ confirm: "REMOVE" }, owner);
    for (const id of [viaButton.pkg.id, edited.pkg.id, attendedPkg.id, changed.pkg.id, normalPkg.id]) {
      assert.equal(await prisma.studentPackage.count({ where: { id } }), 1, "kept");
    }
    assert.equal(await prisma.attendanceRecord.count({ where: { session: { studentId: attended.student.id } } }), 1, "attendance untouched");
    assert.equal(await paymentsSnapshot(), money);
  });

  test("only the owner, only after typing REMOVE", async () => {
    const s = await importedStudent();
    await assert.rejects(removeAutoPackages({ confirm: "REMOVE" }, coordinator), (e: unknown) => e instanceof ApiError && e.status === 403);
    await assert.rejects(removeAutoPackages({ confirm: "yes" }, owner), (e: unknown) => e instanceof ApiError && e.status === 400);
    assert.equal(await prisma.studentPackage.count({ where: { id: s.pkg.id } }), 1);
  });

  test("the backup puts removed packages back exactly", async () => {
    const s = await importedStudent();
    const e = await studentWithSubject(uid("STU"));
    await weeklySlot(e.enrolment.id, e.teacher.id);
    await prisma.payment.create({ data: { paymentNumber: uid("PAY-T"), studentId: e.student.id, amount: 4000, paymentMethod: "UPI", isVerified: true } });
    await editFormAssign(e.student.id, e.subject.id, { type: "PAYMENTS" });

    const backup = JSON.parse(JSON.stringify(await buildAutoPackageBackup(owner))) as AutoPackageBackup;
    const mine = backup.packages.filter((p) => [s.student.id, e.student.id].includes(p.item.student.id));
    assert.equal(mine.length, 2);
    await removeAutoPackages({ confirm: "REMOVE" }, owner);
    assert.equal(await prisma.studentPackage.count({ where: { studentId: { in: [s.student.id, e.student.id] } } }), 0);

    await restoreAutoPackageBackup({ ...backup, packages: mine });
    const after = JSON.parse(JSON.stringify(await buildAutoPackageBackup(owner))) as AutoPackageBackup;
    for (const before of mine) {
      const now = after.packages.find((p) => p.item.packageId === before.item.packageId)!;
      assert.ok(now, `${before.item.packageNumber} is back`);
      assert.deepEqual(now.tables, before.tables);
    }
  });
});
