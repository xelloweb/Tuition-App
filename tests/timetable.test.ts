import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import {
  prisma,
  coordinator,
  makeSubject,
  makeTeacher,
  makeStudent,
  enrol,
  makePackage,
  expectFieldError,
} from "./helpers";
import {
  buildTimetablePlan,
  generateTimetableOccurrences,
  saveTimetable,
  TIMETABLE_WINDOW_DAYS,
} from "../src/lib/services/timetable";
import { parseStudentFields, updateStudent } from "../src/lib/services/students";
import { calculatePackageBalances } from "../src/lib/package-calculations";
import { submitSessionAttendance } from "../src/lib/attendance-ledger";
import { convertSlotForDisplay, describeInZone, minutesToTimeInput, zonedTimeToUtc } from "../src/lib/zoned-time";

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, SAT = 6;
const slot = (enrolmentId: string, weekday: number, start: string, end: string, extra: Record<string, unknown> = {}) => ({
  enrolmentId,
  weekday,
  start,
  end,
  ...extra,
});

async function currentSlots(studentId: string) {
  return prisma.timetableSlot.findMany({
    where: { enrolment: { studentId }, active: true },
    orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }],
  });
}

async function generatedCount(studentId: string) {
  return prisma.session.count({ where: { studentId, timetableSlotId: { not: null } } });
}

describe("weekly timetable", () => {
  let maths: { id: string }, arabic: { id: string }, english: { id: string };

  before(async () => {
    maths = await makeSubject("Mathematics");
    arabic = await makeSubject("Arabic");
    english = await makeSubject("English");
  });

  // Each student gets their own trainers so tests never clash with each other's bookings.
  async function studentWithSubjects(credits = { maths: 40, arabic: 40, english: 40 }) {
    const student = await makeStudent({ timeZone: "Asia/Dubai" });
    const [tm, ta, te] = await Promise.all([makeTeacher("Maths Trainer"), makeTeacher("Arabic Trainer"), makeTeacher("English Trainer")]);
    const em = await enrol(student.id, maths.id, tm.id);
    const ea = await enrol(student.id, arabic.id, ta.id);
    const ee = await enrol(student.id, english.id, te.id);
    const pkg = await makePackage(student.id, [
      { subjectId: maths.id, credits: credits.maths },
      { subjectId: arabic.id, credits: credits.arabic },
      { subjectId: english.id, credits: credits.english },
    ]);
    return { student, em, ea, ee, pkg, tm, ta, te };
  }

  test("checks 1-3, 8, 9: Maths Sun 8-9 PM + Mon 7-8 PM, Arabic Mon 8-9 PM, English Wed 6-7 PM coexist without dates", async () => {
    const { student, em, ea, ee } = await studentWithSubjects();
    await saveTimetable(
      student.id,
      {
        timeZone: "Asia/Kolkata",
        slots: [
          slot(em.id, SUN, "20:00", "21:00"),
          slot(em.id, MON, "19:00", "20:00"),
          slot(ea.id, MON, "20:00", "21:00"), // back-to-back with Maths
          slot(ee.id, WED, "18:00", "19:00"),
        ],
      },
      coordinator
    );
    const saved = await currentSlots(student.id);
    assert.equal(saved.length, 4);
    assert.ok(saved.every((s) => s.timeZone === "Asia/Kolkata"), "timetables are saved in IST");
    assert.deepEqual(
      saved.map((s) => [s.weekday, s.startMinutes, s.endMinutes]),
      [[SUN, 1200, 1260], [MON, 1140, 1200], [MON, 1200, 1260], [WED, 1080, 1140]]
    );
  });

  test("checks 4-5: more slots can be added to the same subject, including two on one day", async () => {
    const { student, em } = await studentWithSubjects();
    await saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SAT, "10:00", "11:00")] }, coordinator);
    let existing = await currentSlots(student.id);
    await saveTimetable(
      student.id,
      { timeZone: "Asia/Kolkata", slots: [...existing.map((s) => ({ id: s.id, enrolmentId: s.enrolmentId, weekday: s.weekday, start: "10:00", end: "11:00" })), slot(em.id, SAT, "15:00", "16:00")] },
      coordinator
    );
    existing = await currentSlots(student.id);
    await saveTimetable(
      student.id,
      {
        timeZone: "Asia/Kolkata",
        slots: [
          { id: existing[0].id, enrolmentId: em.id, weekday: SAT, start: "10:00", end: "11:00" },
          { id: existing[1].id, enrolmentId: em.id, weekday: SAT, start: "15:00", end: "16:00" },
          slot(em.id, TUE, "17:00", "18:00"),
          slot(em.id, THU, "17:00", "18:00"),
        ],
      },
      coordinator
    );
    const saved = await currentSlots(student.id);
    assert.equal(saved.length, 4);
    assert.equal(saved.filter((s) => s.weekday === SAT).length, 2, "two Saturday Maths slots");
  });

  test("check 6: exact duplicate active entries are rejected", async () => {
    const { student, em } = await studentWithSubjects();
    await expectFieldError(
      saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "20:00", "21:00"), slot(em.id, SUN, "20:00", "21:00")] }, coordinator),
      (fe) => /Duplicate/.test(fe["slots.1.start"] ?? "")
    );
    assert.equal((await currentSlots(student.id)).length, 0, "nothing saved");
  });

  test("check 7a: overlapping student classes are rejected across subjects", async () => {
    const { student, em, ee } = await studentWithSubjects();
    await expectFieldError(
      saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, MON, "19:00", "20:00"), slot(ee.id, MON, "19:30", "20:30")] }, coordinator),
      (fe) => /Overlaps/.test(fe["slots.1.start"] ?? "")
    );
  });

  test("check 7b: trainer conflicts are rejected across students, including older slots saved in GCC time", async () => {
    const shared = await makeTeacher("Shared Trainer");
    const dubai = await makeStudent({ timeZone: "Asia/Dubai" });
    const india = await makeStudent({ timeZone: "Asia/Kolkata", country: "India" });
    const e1 = await enrol(dubai.id, maths.id, shared.id);
    const e2 = await enrol(india.id, maths.id, shared.id);
    // An older slot stored in Dubai time: Sun 8-9 PM GST == Sun 9:30-10:30 PM IST (16:00-17:00 UTC).
    await prisma.timetableSlot.create({
      data: { enrolmentId: e1.id, teacherId: shared.id, weekday: SUN, startMinutes: 20 * 60, endMinutes: 21 * 60, timeZone: "Asia/Dubai", effectiveFrom: new Date(), createdByName: "test", createdByRole: "OWNER" },
    });
    await expectFieldError(
      saveTimetable(india.id, { timeZone: "Asia/Kolkata", slots: [slot(e2.id, SUN, "21:30", "22:30")] }, coordinator),
      (fe) => /already teaches/.test(fe["slots.0.start"] ?? "")
    );
    // Back-to-back in absolute time (ends exactly when the other starts) is fine.
    await saveTimetable(india.id, { timeZone: "Asia/Kolkata", slots: [slot(e2.id, SUN, "20:30", "21:30")] }, coordinator);
  });

  test("India time only: another zone is refused, and an older GCC-time slot keeps its real time when edited in IST", async () => {
    const { student, em } = await studentWithSubjects();
    await expectFieldError(
      saveTimetable(student.id, { timeZone: "Asia/Dubai", slots: [slot(em.id, SUN, "20:00", "21:00")] }, coordinator),
      (fe) => /IST/.test(fe.timeZone ?? "")
    );
    await saveTimetable(student.id, { slots: [slot(em.id, SAT, "10:00", "11:00")] }, coordinator);
    assert.ok((await currentSlots(student.id)).every((s) => s.timeZone === "Asia/Kolkata"), "no zone given = IST");

    // An older Dubai-time slot (Sun 8-9 PM GST) shown and saved in IST as Sun 9:30-10:30 PM keeps the same instants.
    const { student: gcc, em: gccMaths } = await studentWithSubjects();
    const legacy = await prisma.timetableSlot.create({
      data: { enrolmentId: gccMaths.id, teacherId: null, weekday: SUN, startMinutes: 20 * 60, endMinutes: 21 * 60, timeZone: "Asia/Dubai", effectiveFrom: new Date(), createdByName: "test", createdByRole: "OWNER" },
    });
    await saveTimetable(gcc.id, { timeZone: "Asia/Kolkata", slots: [{ id: legacy.id, enrolmentId: gccMaths.id, weekday: SUN, start: "21:30", end: "22:30" }] }, coordinator);
    const [converted] = await currentSlots(gcc.id);
    assert.equal(converted.timeZone, "Asia/Kolkata");
    const booked = await prisma.session.findMany({ where: { studentId: gcc.id, timetableSlotId: converted.id } });
    assert.ok(booked.length > 0);
    assert.ok(booked.every((b) => b.scheduledStartTimeUtc.getUTCHours() === 16 && b.scheduledStartTimeUtc.getUTCMinutes() === 0), "same 16:00 UTC as before");
  });

  test("overnight slots are rejected with an instruction to split them", async () => {
    const { student, em } = await studentWithSubjects();
    await expectFieldError(
      saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SAT, "23:00", "00:30")] }, coordinator),
      (fe) => /split them into two entries/.test(fe["slots.0.end"] ?? "")
    );
  });

  test("a subject the student is not enrolled in is rejected", async () => {
    const { student } = await studentWithSubjects();
    const other = await makeStudent();
    const foreign = await enrol(other.id, maths.id, null);
    await expectFieldError(
      saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(foreign.id, SUN, "10:00", "11:00")] }, coordinator),
      (fe) => /enrolled subjects/.test(fe["slots.0.enrolmentId"] ?? "")
    );
  });

  test("class length must match the package's class duration", async () => {
    const { student, em } = await studentWithSubjects();
    await expectFieldError(
      saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "10:00", "11:30")] }, coordinator),
      (fe) => /60 minutes/.test(fe["slots.0.end"] ?? "")
    );
  });

  test("check 10: saving the template does not consume credits; only booked classes reserve them", async () => {
    const { student, em, pkg } = await studentWithSubjects();
    const before = await calculatePackageBalances(pkg.id);
    await saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "20:00", "21:00")] }, coordinator);
    const after = await calculatePackageBalances(pkg.id);
    const booked = await generatedCount(student.id);
    assert.ok(booked >= 3 && booked <= 5, `about 4 weekly classes booked in ${TIMETABLE_WINDOW_DAYS} days, got ${booked}`);
    assert.equal(after!.totalConsumed, before!.totalConsumed, "nothing consumed");
    assert.equal(after!.totalRemaining, before!.totalRemaining, "remaining unchanged");
    assert.equal(after!.totalReserved, before!.totalReserved + booked, "reservations equal booked classes");
  });

  test("check 11a: bookings stop when the subject's credits run out and the shortfall is reported", async () => {
    const { student, em, pkg } = await studentWithSubjects({ maths: 3, arabic: 5, english: 5 });
    const plan = await saveTimetable(
      student.id,
      { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "20:00", "21:00"), slot(em.id, MON, "19:00", "20:00")] },
      coordinator
    );
    assert.equal(await generatedCount(student.id), 3, "only 3 Maths credits available");
    const noCredits = plan.issues.find((i) => i.reason === "NO_CREDITS");
    assert.ok(noCredits && noCredits.count >= 1, "shortfall reported, not silently skipped");
    const bal = await calculatePackageBalances(pkg.id);
    const mathsBal = bal!.subjects.find((s) => s.subjectId === maths.id)!;
    assert.equal(mathsBal.availableCredits, 0);
    const arabicBal = bal!.subjects.find((s) => s.subjectId === arabic.id)!;
    assert.equal(arabicBal.reservedCredits, 0, "Arabic credits were not borrowed");
  });

  test("check 11b: no bookings after package expiry; expiry is reported", async () => {
    const student = await makeStudent({ timeZone: "Asia/Kolkata", country: "India" });
    const em = await enrol(student.id, maths.id, (await makeTeacher("Expiry Trainer")).id);
    const expiry = new Date(Date.now() + 9 * 24 * 3600 * 1000);
    await makePackage(student.id, [{ subjectId: maths.id, credits: 40 }], { expiryDate: expiry });
    const plan = await saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, MON, "18:00", "19:00"), slot(em.id, THU, "18:00", "19:00")] }, coordinator);
    const sessions = await prisma.session.findMany({ where: { studentId: student.id } });
    // Package expiry is an IST date (a UTC date is a day behind between 00:00 and 05:30 IST).
    const limit = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(expiry);
    assert.ok(sessions.every((s) => s.occurrenceDate! <= limit), "nothing booked after expiry");
    assert.ok(plan.issues.some((i) => i.reason === "EXPIRED"), "expiry reported");
  });

  test("a student without a package gets no bookings and a renewal flag", async () => {
    const student = await makeStudent();
    const em = await enrol(student.id, maths.id, (await makeTeacher("No Package Trainer")).id);
    const plan = await saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "20:00", "21:00")] }, coordinator);
    assert.equal(await generatedCount(student.id), 0);
    assert.ok(plan.issues.some((i) => i.reason === "NO_PACKAGE"));
  });

  test("check 12: repeated saves and generation never duplicate bookings", async () => {
    const { student, em, ea } = await studentWithSubjects();
    const input = { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "20:00", "21:00"), slot(ea.id, MON, "20:00", "21:00")] };
    await saveTimetable(student.id, input, coordinator);
    const first = await generatedCount(student.id);
    const saved = await currentSlots(student.id);
    const sameAgain = {
      timeZone: "Asia/Kolkata",
      slots: saved.map((s) => ({
        id: s.id,
        enrolmentId: s.enrolmentId,
        weekday: s.weekday,
        start: minutesToTimeInput(s.startMinutes),
        end: minutesToTimeInput(s.endMinutes),
      })),
    };
    await saveTimetable(student.id, sameAgain, coordinator);
    await generateTimetableOccurrences(student.id, coordinator);
    await generateTimetableOccurrences(student.id, coordinator);
    const results = await Promise.allSettled([
      generateTimetableOccurrences(student.id, coordinator),
      generateTimetableOccurrences(student.id, coordinator),
    ]);
    assert.ok(results.some((r) => r.status === "fulfilled"), "at least one concurrent run succeeds");
    assert.equal(await generatedCount(student.id), first, "no duplicates");
    const dupes = await prisma.session.groupBy({
      by: ["timetableSlotId", "occurrenceDate"],
      where: { studentId: student.id, timetableSlotId: { not: null } },
      _count: { _all: true },
      having: { timetableSlotId: { _count: { gt: 1 } } },
    });
    assert.equal(dupes.length, 0);
  });

  test("check 13: editing or removing a slot keeps completed attendance and changes only future classes", async () => {
    const { student, em, pkg, tm } = await studentWithSubjects();
    await saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "20:00", "21:00")] }, coordinator);
    const [original] = await currentSlots(student.id);

    // A past class from this slot, attended and completed.
    const pastStart = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    const past = await prisma.session.create({
      data: {
        packageId: pkg.id,
        studentId: student.id,
        teacherId: tm.id,
        subjectId: maths.id,
        scheduledStartTimeUtc: pastStart,
        scheduledEndTimeUtc: new Date(pastStart.getTime() + 3600 * 1000),
        timetableSlotId: original.id,
        occurrenceDate: "2000-01-02",
      },
    });
    await submitSessionAttendance({
      sessionId: past.id,
      sessionOutcome: "COMPLETED",
      studentAttendance: "PRESENT",
      actualDurationMinutes: 60,
      topicCovered: "Algebra",
      user: coordinator,
    });

    // Move the slot to Monday 6-7 PM.
    const plan = await saveTimetable(
      student.id,
      { timeZone: "Asia/Kolkata", slots: [{ id: original.id, enrolmentId: em.id, weekday: MON, start: "18:00", end: "19:00" }] },
      coordinator
    );
    assert.equal(plan.versioned.length, 1, "slot with history is versioned, not edited in place");
    const oldVersion = await prisma.timetableSlot.findUniqueOrThrow({ where: { id: original.id } });
    assert.equal(oldVersion.active, false);
    const [current] = await currentSlots(student.id);
    assert.equal(current.previousSlotId, original.id);
    assert.equal(current.weekday, MON);

    const kept = await prisma.session.findUniqueOrThrow({ where: { id: past.id }, include: { attendance: true } });
    assert.equal(kept.timetableSlotId, original.id, "history still points at the original slot");
    assert.equal(kept.isCreditConsumed, true);
    assert.equal(kept.attendance?.sessionOutcome, "COMPLETED");

    const future = await prisma.session.findMany({
      where: { studentId: student.id, scheduledStartTimeUtc: { gt: new Date() }, status: "SCHEDULED" },
    });
    assert.ok(future.length > 0 && future.every((s) => s.timetableSlotId === current.id), "future classes follow the new version");
    assert.ok(
      future.every((s) => describeInZone(s.scheduledStartTimeUtc, "Asia/Kolkata").weekday === MON),
      "future classes are on Monday"
    );

    // Remove the slot entirely: deactivated (has history), future classes released.
    await saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [] }, coordinator);
    assert.equal((await currentSlots(student.id)).length, 0);
    assert.equal(
      await prisma.session.count({ where: { studentId: student.id, status: "SCHEDULED", scheduledStartTimeUtc: { gt: new Date() } } }),
      0,
      "future reservations released"
    );
    const stillThere = await prisma.session.findUniqueOrThrow({ where: { id: past.id }, include: { attendance: true } });
    assert.equal(stillThere.attendance?.sessionOutcome, "COMPLETED", "completed attendance untouched");
  });

  test("cancelled occurrences stay cancelled when the timetable is regenerated", async () => {
    const { student, em } = await studentWithSubjects();
    await saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "20:00", "21:00")] }, coordinator);
    const first = await prisma.session.findFirstOrThrow({
      where: { studentId: student.id, status: "SCHEDULED" },
      orderBy: { scheduledStartTimeUtc: "asc" },
    });
    await prisma.session.update({ where: { id: first.id }, data: { status: "CANCELLED", isCreditReserved: false } });
    await generateTimetableOccurrences(student.id, coordinator);
    const sameDate = await prisma.session.findMany({
      where: { timetableSlotId: first.timetableSlotId, occurrenceDate: first.occurrenceDate },
    });
    assert.equal(sameDate.length, 1);
    assert.equal(sameDate[0].status, "CANCELLED");
  });

  test("one-off bookings that clash with a generated class are reported, not double-booked", async () => {
    const { student, em, pkg, te } = await studentWithSubjects();
    const plan = await buildTimetablePlan(prisma, student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "20:00", "21:00")] });
    const firstDate = plan.occurrences[0];
    await prisma.session.create({
      data: {
        packageId: pkg.id,
        studentId: student.id,
        teacherId: te.id,
        subjectId: english.id,
        scheduledStartTimeUtc: new Date(firstDate.start.getTime() + 30 * 60000),
        scheduledEndTimeUtc: new Date(firstDate.start.getTime() + 90 * 60000),
      },
    });
    const saved = await saveTimetable(student.id, { timeZone: "Asia/Kolkata", slots: [slot(em.id, SUN, "20:00", "21:00")] }, coordinator);
    const conflict = saved.issues.find((i) => i.reason === "CONFLICT");
    assert.ok(conflict && conflict.message.includes(firstDate.occurrenceDate), "conflict names the date");
    assert.equal(saved.occurrences.length, plan.occurrences.length - 1);
  });

  test("check 14: India/GCC conversions show the right time and weekday", () => {
    const utc = zonedTimeToUtc("2026-10-10", 23 * 60, "Asia/Dubai"); // Sat 11 PM GST
    assert.equal(utc.toISOString(), "2026-10-10T19:00:00.000Z");
    const ist = describeInZone(utc, "Asia/Kolkata");
    assert.equal(ist.weekdayShort, "Sun");
    assert.equal(ist.time, "12:30 AM");
    const conv = convertSlotForDisplay({ weekday: SAT, startMinutes: 23 * 60, endMinutes: 23 * 60 + 59, timeZone: "Asia/Dubai" }, "Asia/Kolkata");
    assert.equal(conv.weekdayShort, "Sun");
    assert.equal(conv.dayShift, 1);
    assert.equal(describeInZone(zonedTimeToUtc("2026-10-11", 20 * 60, "Asia/Riyadh"), "Asia/Kolkata").time, "10:30 PM");
  });

  test("timetable slots automatically inherit trainer from subject enrolment without requiring trainer selection", async () => {
    const { student, em, tm } = await studentWithSubjects();
    // Pass slot without teacherId
    await saveTimetable(
      student.id,
      {
        timeZone: "Asia/Kolkata",
        slots: [
          { enrolmentId: em.id, weekday: SUN, start: "10:00", end: "11:00" },
        ],
      },
      coordinator
    );
    const saved = await currentSlots(student.id);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].teacherId, tm.id, "slot inherited subject enrolment's assigned trainer");
  });

  test("subject without assigned trainer creates timetable slots without requiring trainer selection and flags NO_TRAINER", async () => {
    const student = await makeStudent({ timeZone: "Asia/Dubai" });
    const noTrainerEnrol = await enrol(student.id, maths.id, null); // no trainer assigned
    await makePackage(student.id, [{ subjectId: maths.id, credits: 10 }]);

    const plan = await buildTimetablePlan(prisma, student.id, {
      timeZone: "Asia/Kolkata",
      slots: [{ enrolmentId: noTrainerEnrol.id, weekday: MON, start: "16:00", end: "17:00" }],
    });
    assert.equal(plan.slots.length, 1);
    assert.equal(plan.slots[0].teacherId, null);
    const noTrainerIssue = plan.issues.find((i) => i.reason === "NO_TRAINER");
    assert.ok(noTrainerIssue, "flags NO_TRAINER issue during occurrence generation");

    // Can be saved successfully
    await saveTimetable(student.id, {
      timeZone: "Asia/Kolkata",
      slots: [{ enrolmentId: noTrainerEnrol.id, weekday: MON, start: "16:00", end: "17:00" }],
    }, coordinator);
    const saved = await currentSlots(student.id);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].teacherId, null);
  });

  test("reassigning a subject trainer in Subjects & Trainers automatically updates active timetable slots", async () => {
    const { student, em, tm } = await studentWithSubjects();
    await saveTimetable(
      student.id,
      {
        timeZone: "Asia/Kolkata",
        slots: [{ enrolmentId: em.id, weekday: SUN, start: "10:00", end: "11:00" }],
      },
      coordinator
    );
    const beforeSlots = await currentSlots(student.id);
    assert.equal(beforeSlots[0].teacherId, tm.id);

    // Reassign Maths to a new trainer
    const newTrainer = await makeTeacher("New Maths Trainer");
    await updateStudent(
      student.id,
      parseStudentFields({ enrolments: [{ subjectId: maths.id, teacherId: newTrainer.id }] }, { partial: true }),
      coordinator
    );

    const afterSlots = await currentSlots(student.id);
    assert.equal(afterSlots[0].teacherId, newTrainer.id, "active slot teacherId updated to new trainer");
  });
});
