/**
 * Trainer timetables (owner/coordinator view and allocation checks):
 * week view, student list, free time, overlap detection, back-to-back allowed,
 * and no double booking through timetable saves or trainer changes.
 */
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { prisma, coordinator, makeSubject, makeTeacher, makeStudent, enrol } from "./helpers";
import { getTrainerSchedule, trainerChangeClash } from "../src/lib/services/trainer-schedule";
import { findTrainerSlotClashes, saveTimetable } from "../src/lib/services/timetable";
import { buildWeek, findWeeklyOverlap, minutesOverlap } from "../src/lib/trainer-week";
import { ApiError } from "../src/lib/api-errors";

const IST = "Asia/Kolkata";
const MON = 1;
const h = (hh: number, mm = 0) => hh * 60 + mm;

async function slot(enrolmentId: string, teacherId: string, weekday: number, start: number, end: number) {
  return prisma.timetableSlot.create({
    data: { enrolmentId, teacherId, weekday, startMinutes: start, endMinutes: end, timeZone: IST, effectiveFrom: new Date(Date.now() - 86400000), createdByName: "test", createdByRole: "OWNER" },
  });
}

let t1: { id: string; name: string };
let t2: { id: string; name: string };
let s1: { id: string; name: string };
let s2: { id: string; name: string };
let s3: { id: string; name: string };
let e3: { id: string };

before(async () => {
  const subject = await makeSubject("Physics");
  t1 = await makeTeacher("Week Trainer One");
  t2 = await makeTeacher("Week Trainer Two");
  s1 = await makeStudent();
  s2 = await makeStudent();
  s3 = await makeStudent();
  const e1 = await enrol(s1.id, subject.id, t1.id);
  const e2 = await enrol(s2.id, subject.id, t1.id);
  e3 = await enrol(s3.id, subject.id, t2.id);
  await slot(e1.id, t1.id, MON, h(19), h(20)); // 7–8 PM
  await slot(e2.id, t1.id, MON, h(20), h(21)); // 8–9 PM, back-to-back
  await slot(e3.id, t2.id, MON, h(19, 30), h(20, 30)); // another trainer
});

describe("trainer week view", () => {
  test("Monday lists the trainer's classes in time order with students and free time", async () => {
    const schedule = await getTrainerSchedule(t1.id);
    const monday = schedule.week.find((d) => d.weekday === MON)!;
    assert.equal(schedule.week[0].name, "Monday", "the week starts on Monday");
    assert.equal(schedule.week[6].name, "Sunday");
    assert.deepEqual(monday.classes.map((c) => [c.studentName, c.startMinutes, c.endMinutes]), [
      [s1.name, h(19), h(20)],
      [s2.name, h(20), h(21)],
    ]);
    assert.deepEqual(monday.free, [
      { startMinutes: h(6), endMinutes: h(19) },
      { startMinutes: h(21), endMinutes: h(23) },
    ]);
    assert.equal(schedule.totals.students, 2);
    assert.equal(schedule.totals.weeklyClasses, 2);
    assert.equal(schedule.totals.weeklyMinutes, 120);
    const student = schedule.students.find((s) => s.studentId === s1.id)!;
    assert.deepEqual(student.subjects[0].slots, [{ weekday: MON, startMinutes: h(19), endMinutes: h(20) }]);
  });

  test("leaving out the student being edited", async () => {
    const schedule = await getTrainerSchedule(t1.id, { excludeStudentId: s1.id });
    assert.deepEqual(schedule.slots.map((s) => s.studentId), [s2.id]);
    assert.equal(schedule.students.length, 1);
  });

  test("stated available days are shown; overlap rules allow back-to-back", () => {
    const week = buildWeek([], "Mon, Wed");
    assert.equal(week.find((d) => d.weekday === 1)!.statedAvailable, true);
    assert.equal(week.find((d) => d.weekday === 2)!.statedAvailable, false);
    assert.equal(minutesOverlap(h(19), h(20), h(20), h(21)), false);
    assert.equal(minutesOverlap(h(19), h(20), h(19, 59), h(21)), true);
    const booked = [{ weekday: MON, startMinutes: h(19), endMinutes: h(20), studentId: "x" }];
    assert.ok(findWeeklyOverlap(booked, { weekday: MON, startMinutes: h(19, 30), endMinutes: h(20, 30) }));
    assert.equal(findWeeklyOverlap(booked, { weekday: MON, startMinutes: h(18), endMinutes: h(19) }), null);
    assert.equal(findWeeklyOverlap(booked, { weekday: 2, startMinutes: h(19), endMinutes: h(20) }), null);
  });
});

describe("no double booking", () => {
  test("the shared clash check names the existing class; back-to-back passes", async () => {
    const [clash, backToBack] = await findTrainerSlotClashes(prisma, t1.id, [
      { weekday: MON, startMinutes: h(19, 30), endMinutes: h(20, 30), timeZone: IST },
      { weekday: MON, startMinutes: h(18), endMinutes: h(19), timeZone: IST },
    ]);
    assert.ok(clash && [s1.name, s2.name].includes(clash.studentName));
    assert.match(clash!.label, /Monday/);
    assert.equal(backToBack, null);
  });

  test("changing a subject's trainer is refused when its class overlaps the new trainer's week", async () => {
    const clash = await trainerChangeClash(prisma, { enrolmentId: e3.id, studentId: s3.id, teacherId: t1.id });
    assert.ok(clash, "7:30–8:30 PM overlaps the new trainer's 7–8 PM and 8–9 PM classes");
    assert.match(clash!.message, /already teaches/);
    assert.match(clash!.message, /overlaps/);
    // Nothing was changed by the check.
    const still = await prisma.subjectEnrollment.findUniqueOrThrow({ where: { id: e3.id } });
    assert.equal(still.teacherId, t2.id);
  });

  test("a trainer change into a back-to-back time is allowed", async () => {
    const subject = await makeSubject("Biology");
    const s4 = await makeStudent();
    const e4 = await enrol(s4.id, subject.id, t2.id);
    await slot(e4.id, t2.id, MON, h(21), h(22)); // right after t1's 8–9 PM class
    assert.equal(await trainerChangeClash(prisma, { enrolmentId: e4.id, studentId: s4.id, teacherId: t1.id }), null);
  });

  test("saving a weekly slot that overlaps another student's class with the same trainer is refused", async () => {
    const subject = await makeSubject("Maths");
    const s5 = await makeStudent();
    const e5 = await enrol(s5.id, subject.id, t1.id);
    await assert.rejects(
      saveTimetable(s5.id, { timeZone: IST, slots: [{ enrolmentId: e5.id, weekday: MON, start: "19:30", end: "20:30" }] }, coordinator),
      (err: unknown) => err instanceof ApiError && Object.values(err.fieldErrors ?? {}).some((m) => /already teaches/.test(m))
    );
    assert.equal(await prisma.timetableSlot.count({ where: { enrolmentId: e5.id } }), 0, "nothing saved");
    // Back-to-back after the trainer's last class is accepted.
    await saveTimetable(s5.id, { timeZone: IST, slots: [{ enrolmentId: e5.id, weekday: MON, start: "21:00", end: "22:00" }] }, coordinator);
    assert.equal(await prisma.timetableSlot.count({ where: { enrolmentId: e5.id, active: true } }), 1);
    // The trainer's week shows it at once (read live).
    const monday = (await getTrainerSchedule(t1.id)).week.find((d) => d.weekday === MON)!;
    assert.ok(monday.classes.some((c) => c.studentId === s5.id && c.startMinutes === h(21)));
  });
});
