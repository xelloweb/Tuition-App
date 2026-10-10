/**
 * Permanent student deletion (owner only, archived students): everything that
 * belongs to the student goes, their number is free for a fresh admission,
 * other students, trainers and the audit log stay, settled trainer pay and
 * shared records block it, and the backup restores every row.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, makeSubject, makeTeacher, makeStudent, makePackage, enrol, uid } from "./helpers";
import { createStudent, deleteStudent, findGuardiansByPhone, parseStudentFields } from "../src/lib/services/students";
import { recordManualAttendance } from "../src/lib/services/manual-attendance";
import { verifyAndAllocatePayment } from "../src/lib/billing";
import {
  PURGE_TABLES,
  PurgeTable,
  StudentBackup,
  buildStudentBackup,
  previewStudentPurge,
  purgeStudent,
  restoreStudentBackup,
} from "../src/lib/services/student-purge";
import { ApiError } from "../src/lib/api-errors";
import { nextCode } from "../src/lib/codes";
import { CurrentUser } from "../src/lib/types";

const istDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const freshPhone = () => `+971 5${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const idField = (t: PurgeTable) => (t === "IdempotencyKey" ? "key" : "id");
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
type Finder = { count: (a: unknown) => Promise<number> };

async function rejects(promise: Promise<unknown>, status: number, pattern?: RegExp) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof ApiError, String(err));
    assert.equal(err.status, status, err.message);
    if (pattern) assert.match(err.message, pattern);
    return true;
  });
}

/** How many of the backed-up rows still exist, per table. */
async function remaining(backup: StudentBackup) {
  const out: Record<string, number> = {};
  for (const t of PURGE_TABLES) {
    const ids = backup.tables[t].map((r) => r[idField(t)] as string);
    if (!ids.length) continue;
    out[t] = await (prisma as unknown as Record<string, Finder>)[lower(t)].count({ where: { [idField(t)]: { in: ids } } });
  }
  return out;
}

/** A student with nearly every kind of record, admitted through the normal admission. */
async function fullStudent() {
  const subject = await makeSubject("Purge Maths");
  const teacher = await makeTeacher("Purge Trainer");
  const trainer: CurrentUser = { id: uid("u"), name: teacher.name, email: teacher.email, role: "TEACHER", teacherId: teacher.id };
  const phone = freshPhone();
  const inThreeDays = new Date(Date.now() + 3 * 86400000);
  const weekday = new Date(`${istDate(inThreeDays)}T12:00:00+05:30`).getUTCDay();
  const fields = parseStudentFields(
    {
      name: uid("Purge Pupil"),
      grade: "8th Grade",
      guardianName: "Fictional Purge Parent",
      whatsappNumber: phone,
      country: "UAE",
      preferredDays: [1, 3],
      enrolments: [{ subjectId: subject.id, teacherId: teacher.id }],
      initialPackage: { totalCredits: 8, price: 4000, startDate: istDate(new Date(Date.now() - 7 * 86400000)), allocations: [{ subjectId: subject.id, allocatedCredits: 8 }] },
      slots: [{ subjectId: subject.id, teacherId: teacher.id, weekday, start: "18:00", end: "19:00" }],
    },
    { partial: false }
  );
  const { result } = await createStudent(fields, coordinator, uid("idem-purge"));
  const studentId = result.id;

  // An attended class (credit used, trainer pay pending), a verified payment against the invoice.
  await recordManualAttendance({ studentId, subjectId: subject.id, classDate: istDate(new Date(Date.now() - 86400000)), durationMinutes: 60, topicCovered: "Fractions" }, trainer);
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { studentId } });
  const payment = await prisma.payment.create({ data: { paymentNumber: await nextCode(prisma, "payment"), studentId, amount: 4000, paymentMethod: "UPI" } });
  await verifyAndAllocatePayment({ paymentId: payment.id, invoiceId: invoice.id, user: owner });

  await prisma.followUp.create({ data: { studentId, type: "ACADEMIC_CHECKIN", assignedStaff: "Coordinator", notes: "Fictional note" } });
  await prisma.studentProgress.create({ data: { studentId, subjectId: subject.id, teacherId: teacher.id, monthYear: "2026-10", topicProgress: "Fractions", teacherFeedback: "Good" } });
  await prisma.assessment.create({ data: { studentId, subjectId: subject.id, teacherId: teacher.id, assessmentTitle: "Unit test", score: 8, maxScore: 10, percentage: 80 } });
  await prisma.parentConcern.create({ data: { studentId, category: "TIMING", description: "Fictional concern", owner: "Coordinator" } });
  await prisma.parentSubmission.create({
    data: {
      reference: uid("XA"), submissionKey: uid("key-pppppppppppp"), submittedData: "{}", studentName: result.name, grade: "8th Grade", board: "CBSE",
      subjectNames: subject.name, guardianName: "Fictional Purge Parent", whatsappNumber: phone, whatsappKey: phone.replace(/\D/g, ""), country: "UAE", linkedStudentId: studentId,
    },
  });
  return { studentId, studentCode: result.studentCode, name: result.name, phone, subject, teacher };
}

const archive = (id: string) => prisma.student.update({ where: { id }, data: { status: "WITHDRAWN" } });

/** Rows of an unrelated student taught by the same trainer, to prove they are untouched. */
async function bystander(teacherId: string, subjectId: string) {
  const other = await makeStudent();
  await enrol(other.id, subjectId, teacherId);
  const pkg = await makePackage(other.id, [{ subjectId, credits: 4 }]);
  const start = new Date(Date.now() + 2 * 86400000);
  await prisma.session.create({ data: { packageId: pkg.id, studentId: other.id, teacherId, subjectId, scheduledStartTimeUtc: start, scheduledEndTimeUtc: new Date(start.getTime() + 3600000) } });
  const snapshot = async () =>
    JSON.stringify(
      await prisma.student.findUniqueOrThrow({
        where: { id: other.id },
        include: { guardian: true, enrolments: true, packages: { include: { allocations: true } }, sessions: true },
      })
    );
  return { other, snapshot, before: await snapshot() };
}

describe("permanent student deletion", () => {
  test("the preview shows who and what; a student who is not archived cannot be deleted", async () => {
    const s = await fullStudent();
    let p = await previewStudentPurge(s.studentId);
    assert.match(p.blockers.join(" "), /not archived/);
    await rejects(purgeStudent(s.studentId, { confirmStudentCode: s.studentCode }, owner), 409, /not archived/);
    assert.equal(await prisma.student.count({ where: { id: s.studentId } }), 1, "nothing deleted");

    await archive(s.studentId);
    p = await previewStudentPurge(s.studentId);
    assert.deepEqual(p.blockers, []);
    assert.equal(p.student.studentCode, s.studentCode);
    assert.equal(p.student.whatsappNumber.replace(/\D/g, ""), s.phone.replace(/\D/g, ""));
    assert.equal(p.guardian.removed, true);
    assert.equal(p.subjects.length, 1);
    assert.equal(p.weeklySlots, 1);
    assert.equal(p.packages.length, 1);
    assert.equal(p.classes.attended, 1);
    assert.ok(p.classes.upcoming >= 1, "the booked weekly class");
    assert.equal(p.invoices.length, 1);
    assert.deepEqual(p.payments.map((x) => x.amount), [4000]);
    assert.equal(p.trainerPayPending.classes, 1);
    assert.deepEqual(p.other, { followUps: 1, progressNotes: 1, assessments: 1, parentConcerns: 1, parentForms: 1 });
  });

  test("only the owner, and only after typing the student code", async () => {
    const s = await fullStudent();
    await archive(s.studentId);
    await rejects(purgeStudent(s.studentId, { confirmStudentCode: s.studentCode }, coordinator), 403);
    await assert.rejects(purgeStudent(s.studentId, { confirmStudentCode: "XEL-WRONG" }, owner), (err: unknown) => {
      assert.ok(err instanceof ApiError && err.status === 400 && err.fieldErrors?.confirmStudentCode);
      return true;
    });
    assert.equal(await prisma.student.count({ where: { id: s.studentId } }), 1, "nothing deleted");
  });

  test("deleting removes every record of the student and frees the number; other students, trainers and the audit log stay", async () => {
    const s = await fullStudent();
    const others = await bystander(s.teacher.id, s.subject.id);
    await archive(s.studentId);
    const backup = await buildStudentBackup(s.studentId, owner);
    const auditBefore = await prisma.auditLog.count({ where: { entityId: s.studentId } });
    const payoutBefore = await prisma.payoutItem.count();
    const deletedPay = backup.tables.PayoutItem.length;

    const result = await purgeStudent(s.studentId, { confirmStudentCode: s.studentCode.toLowerCase() }, owner);
    assert.match(result.message, /permanently deleted/);
    for (const [table, left] of Object.entries(await remaining(backup))) assert.equal(left, 0, `${table} rows left`);
    for (const t of ["Student", "Guardian", "SubjectEnrollment", "TimetableSlot", "StudentPackage", "Session", "AttendanceRecord", "CreditLedger", "PayoutItem", "Invoice", "Payment", "PaymentAllocation", "FollowUp", "StudentProgress", "Assessment", "ParentConcern", "ParentSubmission"] as PurgeTable[]) {
      assert.ok(backup.tables[t].length > 0, `${t} was in the backup`);
    }
    assert.equal(await prisma.payoutItem.count(), payoutBefore - deletedPay, "only this student's trainer pay");
    assert.equal(await prisma.session.count({ where: { studentId: s.studentId } }), 0, "no classes left on the trainer's list");

    assert.equal(await others.snapshot(), others.before, "the other student is untouched");
    assert.equal(await prisma.teacher.count({ where: { id: s.teacher.id } }), 1, "the trainer stays");
    assert.equal(await prisma.auditLog.count({ where: { entityId: s.studentId, action: { not: "PURGE_STUDENT" } } }), auditBefore, "earlier audit entries are kept");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: s.studentId, action: "PURGE_STUDENT" } });
    assert.match(audit.details, new RegExp(s.studentCode));

    // The number is free: no parent matches it, and a fresh admission starts clean.
    assert.deepEqual(await findGuardiansByPhone(s.phone), []);
    const again = await createStudent(
      parseStudentFields({ name: s.name, grade: "8th Grade", guardianName: "Fictional Purge Parent", whatsappNumber: s.phone, country: "UAE", enrolments: [{ subjectId: s.subject.id, teacherId: s.teacher.id }] }, { partial: false }),
      coordinator,
      uid("idem-again")
    );
    assert.notEqual(again.result.studentCode, s.studentCode, "a new student code");
    // Deleted numbers are never issued again.
    const num = (code: string) => Number(code.split("-").pop());
    for (const [kind, rows, field] of [["package", backup.tables.StudentPackage, "packageNumber"], ["invoice", backup.tables.Invoice, "invoiceNumber"], ["payment", backup.tables.Payment, "paymentNumber"]] as const) {
      for (const r of rows) assert.ok(num(await nextCode(prisma, kind)) > num(r[field] as string), `${kind} ${r[field]} retired`);
    }
    assert.equal(await prisma.studentPackage.count({ where: { studentId: again.result.id } }), 0, "no old packages");
    assert.equal(await prisma.payment.count({ where: { studentId: again.result.id } }), 0, "no old payments");
    assert.equal(await prisma.session.count({ where: { studentId: again.result.id } }), 0, "no old classes");
    const matches = await findGuardiansByPhone(s.phone);
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].students.map((x) => x.id), [again.result.id]);
  });

  test("the backup puts every record back exactly", async () => {
    const s = await fullStudent();
    await archive(s.studentId);
    const backup = JSON.parse(JSON.stringify(await buildStudentBackup(s.studentId, owner))) as StudentBackup; // as downloaded
    await purgeStudent(s.studentId, { confirmStudentCode: s.studentCode }, owner);
    assert.equal(await prisma.student.count({ where: { id: s.studentId } }), 0);

    await restoreStudentBackup(backup, "Test restore");
    const after = JSON.parse(JSON.stringify(await buildStudentBackup(s.studentId, owner))) as StudentBackup;
    for (const t of PURGE_TABLES) assert.deepEqual(after.tables[t], backup.tables[t], `${t} restored`);
    // Restoring twice adds nothing.
    await restoreStudentBackup(backup, "Test restore");
    assert.equal(await prisma.session.count({ where: { studentId: s.studentId } }), backup.tables.Session.length);
  });

  test("trainer pay already in a pay run (or paid) blocks the delete; nothing is removed", async () => {
    const s = await fullStudent();
    await archive(s.studentId);
    const run = await prisma.payoutRun.create({ data: { runNumber: uid("RUN-T"), periodStart: new Date(Date.now() - 30 * 86400000), periodEnd: new Date(), status: "APPROVED" } });
    await prisma.payoutItem.updateMany({ where: { session: { studentId: s.studentId } }, data: { payoutRunId: run.id } });
    const p = await previewStudentPurge(s.studentId);
    assert.match(p.blockers.join(" "), /Trainer pay .* already in a pay run or paid/);
    await rejects(purgeStudent(s.studentId, { confirmStudentCode: s.studentCode }, owner), 409, /already in a pay run or paid/);
    assert.equal(await prisma.student.count({ where: { id: s.studentId } }), 1);

    await prisma.payoutItem.updateMany({ where: { session: { studentId: s.studentId } }, data: { payoutRunId: null, status: "PAID" } });
    await rejects(purgeStudent(s.studentId, { confirmStudentCode: s.studentCode }, owner), 409, /already in a pay run or paid/);
  });

  test("a payment shared with another student's invoice blocks the delete", async () => {
    const s = await fullStudent();
    await archive(s.studentId);
    const other = await makeStudent();
    const inv = await prisma.invoice.create({
      data: { invoiceNumber: uid("INV-T"), studentId: other.id, subtotal: 500, totalAmount: 500, balanceDue: 500, dueDate: new Date() },
    });
    const pay = await prisma.payment.findFirstOrThrow({ where: { studentId: s.studentId } });
    await prisma.paymentAllocation.create({ data: { paymentId: pay.id, invoiceId: inv.id, amount: 100 } });
    await rejects(purgeStudent(s.studentId, { confirmStudentCode: s.studentCode }, owner), 409, /shared between this student and another student/);
  });

  test("a brother or sister keeps the parent record and its number", async () => {
    const s = await fullStudent();
    const student = await prisma.student.findUniqueOrThrow({ where: { id: s.studentId } });
    const sibling = await prisma.student.create({
      data: { studentCode: uid("TST"), name: uid("Purge Sibling"), grade: "5th Grade", guardianId: student.guardianId, guardianName: student.guardianName, whatsappNumber: student.whatsappNumber },
    });
    await archive(s.studentId);
    const p = await previewStudentPurge(s.studentId);
    assert.equal(p.guardian.removed, false);
    assert.deepEqual(p.guardian.otherChildren.map((c) => c.studentCode), [sibling.studentCode]);
    await purgeStudent(s.studentId, { confirmStudentCode: s.studentCode }, owner);
    const matches = await findGuardiansByPhone(s.phone);
    assert.equal(matches.length, 1, "the parent stays");
    assert.deepEqual(matches[0].students.map((x) => x.id), [sibling.id]);
  });

  test("the ordinary delete of an archived student with history points the owner to permanent delete", async () => {
    const s = await fullStudent();
    await archive(s.studentId);
    await rejects(deleteStudent(s.studentId, owner), 409, /Permanently delete \(with backup\)/);
  });
});
