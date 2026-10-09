/**
 * Package consumption: attendance completes the booked class (consumed, no
 * longer reserved), Remaining = Entitled − Consumed at package and subject
 * level, deletion reverses it, and the one-time correction merges old pairs.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, makeSubject, makeTeacher, makeStudent, makePackage, enrol, uid } from "./helpers";
import { recordManualAttendance, deleteManualAttendance } from "../src/lib/services/manual-attendance";
import { calculatePackageBalances } from "../src/lib/package-calculations";
import { submitSessionAttendance } from "../src/lib/attendance-ledger";
import { mergeAttendanceDuplicates } from "../scripts/merge-attendance-duplicates";
import { CurrentUser } from "../src/lib/types";

const istDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const daysAgo = (n: number, hourIst = 19) => {
  const date = istDate(new Date(Date.now() - n * 86400000));
  return new Date(`${date}T${String(hourIst).padStart(2, "0")}:00:00+05:30`);
};

/** A student with a 12-class package whose weekly slot booked classes, plus a newer package for the same subject. */
async function setup(subjectName = "Hindi", credits = 12) {
  const subject = await makeSubject(subjectName);
  const teacher = await makeTeacher("Consumption Trainer");
  const student = await makeStudent();
  const enrolment = await enrol(student.id, subject.id, teacher.id);
  const pkgA = await makePackage(student.id, [{ subjectId: subject.id, credits }], { startDate: new Date(Date.now() - 30 * 86400000) });
  const slot = await prisma.timetableSlot.create({
    data: { enrolmentId: enrolment.id, teacherId: teacher.id, weekday: 1, startMinutes: 19 * 60, endMinutes: 20 * 60, timeZone: "Asia/Kolkata", effectiveFrom: new Date(Date.now() - 30 * 86400000), createdByName: "test", createdByRole: "OWNER" },
  });
  const booked = [];
  for (const n of [2, 1]) {
    const start = daysAgo(n);
    booked.push(
      await prisma.session.create({
        data: { packageId: pkgA.id, studentId: student.id, teacherId: teacher.id, subjectId: subject.id, timetableSlotId: slot.id, occurrenceDate: istDate(start), scheduledStartTimeUtc: start, scheduledEndTimeUtc: new Date(start.getTime() + 3600000) },
      })
    );
  }
  const pkgB = await makePackage(student.id, [{ subjectId: subject.id, credits: 12 }]); // newer: the old code consumed from this one
  const trainer: CurrentUser = { id: uid("u"), name: teacher.name, email: teacher.email, role: "TEACHER", teacherId: teacher.id };
  return { subject, teacher, student, pkgA, pkgB, slot, booked, trainer };
}

describe("attendance consumes the booked class", () => {
  test("the example: 12 entitled, 2 attended → Consumed 2, Remaining 10, nothing reserved for those classes", async () => {
    const s = await setup();
    for (const b of s.booked) {
      await recordManualAttendance({ studentId: s.student.id, subjectId: s.subject.id, classDate: istDate(b.scheduledStartTimeUtc), durationMinutes: 60, topicCovered: "Lesson" }, s.trainer);
    }
    const a = (await calculatePackageBalances(s.pkgA.id))!;
    assert.equal(a.totalEntitlement, 12);
    assert.equal(a.totalConsumed, 2);
    assert.equal(a.totalRemaining, 10);
    assert.equal(a.totalReserved, 0);
    const b = (await calculatePackageBalances(s.pkgB.id))!;
    assert.equal(b.totalConsumed, 0, "the other package is untouched");
    // One record per class: the booked classes were completed, no extra classes created.
    assert.equal(await prisma.session.count({ where: { studentId: s.student.id } }), 2);
    for (const bk of s.booked) {
      const after = await prisma.session.findUniqueOrThrow({ where: { id: bk.id }, include: { attendance: true } });
      assert.equal(after.status, "COMPLETED");
      assert.equal(after.isCreditConsumed, true);
      assert.ok(after.attendance);
    }
  });

  test("subject level: Hindi 4 allocated, 1 attended → Allocated 4, Consumed 1, Remaining 3", async () => {
    const s = await setup("Hindi", 4);
    await recordManualAttendance({ studentId: s.student.id, subjectId: s.subject.id, classDate: istDate(s.booked[0].scheduledStartTimeUtc), durationMinutes: 60, topicCovered: "Varnamala" }, s.trainer);
    const sub = (await calculatePackageBalances(s.pkgA.id))!.subjects.find((x) => x.subjectId === s.subject.id)!;
    assert.deepEqual([sub.allocatedCredits, sub.consumedCredits, sub.remainingCredits], [4, 1, 3]);
  });

  test("future booked classes are not consumed", async () => {
    const s = await setup();
    const start = new Date(Date.now() + 3 * 86400000);
    await prisma.session.create({ data: { packageId: s.pkgA.id, studentId: s.student.id, teacherId: s.teacher.id, subjectId: s.subject.id, scheduledStartTimeUtc: start, scheduledEndTimeUtc: new Date(start.getTime() + 3600000) } });
    assert.equal((await calculatePackageBalances(s.pkgA.id))!.totalConsumed, 0);
    assert.equal((await calculatePackageBalances(s.pkgA.id))!.totalRemaining, 12);
  });

  test("deleting the attendance puts the class back as booked and unconsumed", async () => {
    const s = await setup();
    const att = await recordManualAttendance({ studentId: s.student.id, subjectId: s.subject.id, classDate: istDate(s.booked[0].scheduledStartTimeUtc), durationMinutes: 60, topicCovered: "x" }, s.trainer);
    assert.equal((await calculatePackageBalances(s.pkgA.id))!.totalConsumed, 1);
    await deleteManualAttendance(att.attendanceId, owner);
    const back = await prisma.session.findUniqueOrThrow({ where: { id: s.booked[0].id }, include: { attendance: true } });
    assert.equal(back.status, "SCHEDULED");
    assert.equal(back.isCreditConsumed, false);
    assert.equal(back.attendance, null);
    assert.equal(back.timetableSlotId, s.slot.id, "the class stays in the timetable");
    assert.equal((await calculatePackageBalances(s.pkgA.id))!.totalConsumed, 0);
  });

  test("the same class is never consumed twice", async () => {
    const s = await setup();
    const input = { studentId: s.student.id, subjectId: s.subject.id, classDate: istDate(s.booked[0].scheduledStartTimeUtc), durationMinutes: 60, topicCovered: "x" };
    await recordManualAttendance(input, s.trainer);
    const again = await recordManualAttendance(input, s.trainer); // a double tap
    assert.equal(again.alreadyProcessed, true);
    assert.equal((await calculatePackageBalances(s.pkgA.id))!.totalConsumed, 1);
  });

  test("absent follows the package's no-show rule", async () => {
    const s = await setup();
    await prisma.studentPackage.update({ where: { id: s.pkgA.id }, data: { noShowDeductCredit: false } });
    await submitSessionAttendance({ sessionId: s.booked[0].id, sessionOutcome: "STUDENT_NO_SHOW", studentAttendance: "ABSENT", actualDurationMinutes: 60, topicCovered: "Not recorded", user: owner });
    assert.equal((await calculatePackageBalances(s.pkgA.id))!.totalConsumed, 0, "not consumed when the package says so");
    await prisma.studentPackage.update({ where: { id: s.pkgA.id }, data: { noShowDeductCredit: true } });
    await submitSessionAttendance({ sessionId: s.booked[1].id, sessionOutcome: "STUDENT_NO_SHOW", studentAttendance: "ABSENT", actualDurationMinutes: 60, topicCovered: "Not recorded", user: owner });
    assert.equal((await calculatePackageBalances(s.pkgA.id))!.totalConsumed, 1, "consumed when the package says so");
  });
});

describe("one-time correction of existing pairs", () => {
  test("an attendance record made beside its booked class is merged into it; running again changes nothing", async () => {
    const s = await setup();
    // The old behaviour: a separate completed class on the newer package, the booking left scheduled.
    const old = await prisma.session.create({
      data: { packageId: s.pkgB.id, studentId: s.student.id, teacherId: s.teacher.id, subjectId: s.subject.id, scheduledStartTimeUtc: new Date(`${istDate(s.booked[0].scheduledStartTimeUtc)}T12:00:00+05:30`), scheduledEndTimeUtc: new Date(`${istDate(s.booked[0].scheduledStartTimeUtc)}T13:00:00+05:30`), status: "COMPLETED", isCreditReserved: false, isCreditConsumed: true },
    });
    const att = await prisma.attendanceRecord.create({ data: { sessionId: old.id, sessionOutcome: "COMPLETED", studentAttendance: "PRESENT", actualDurationMinutes: 60, topicCovered: "Old way", markedByRole: "TEACHER", markedByName: s.teacher.name } });
    await prisma.creditLedger.create({ data: { packageId: s.pkgB.id, subjectId: s.subject.id, eventType: "SESSION_CONSUMED", creditsDelta: -1, sessionId: old.id, reason: "Manual attendance: 1 credit(s) consumed (1 hr(s))", actorRole: "TEACHER", actorName: s.teacher.name } });
    const pay = await prisma.payoutItem.create({ data: { teacherId: s.teacher.id, sessionId: old.id, sessionDate: old.scheduledStartTimeUtc, durationMinutes: 60, rateSnapshot: 500, amount: 500 } });

    // Before: consumed on the wrong package, the booking still reserved.
    assert.equal((await calculatePackageBalances(s.pkgA.id))!.totalConsumed, 0);
    assert.equal((await calculatePackageBalances(s.pkgA.id))!.totalReserved, 2);

    const first = await mergeAttendanceDuplicates(prisma);
    assert.ok(first.merged.some((m) => m.from === old.id && m.into === s.booked[0].id));
    const a = (await calculatePackageBalances(s.pkgA.id))!;
    assert.deepEqual([a.totalEntitlement, a.totalConsumed, a.totalRemaining, a.totalReserved], [12, 1, 11, 1]);
    assert.equal((await calculatePackageBalances(s.pkgB.id))!.totalConsumed, 0);
    // Attendance, pay record and credit history are kept, on the booked class.
    assert.equal((await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: att.id } })).sessionId, s.booked[0].id);
    assert.equal((await prisma.payoutItem.findUniqueOrThrow({ where: { id: pay.id } })).sessionId, s.booked[0].id);
    assert.equal(await prisma.creditLedger.count({ where: { sessionId: s.booked[0].id, packageId: s.pkgA.id, eventType: "SESSION_CONSUMED" } }), 1);
    assert.equal(await prisma.session.count({ where: { id: old.id } }), 0);

    const second = await mergeAttendanceDuplicates(prisma);
    assert.equal(second.merged.filter((m) => m.studentId === s.student.id).length, 0);
  });
});
