/**
 * Admission: the student, guardian, enrolments, package, weekly slots and first
 * bookings are saved together or not at all; drafts never create placeholders.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, coordinator, owner, makeSubject, makeTeacher, uid, expectFieldError } from "./helpers";
import { checkAdmission, createStudent, parseStudentFields } from "../src/lib/services/students";
import { createDraft, deleteDraft, updateDraft } from "../src/lib/services/admission-drafts";
import { ApiError } from "../src/lib/api-errors";

const today = () => new Date().toISOString().slice(0, 10);

function admission(subjectId: string, teacherId: string, slots: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  return {
    name: `Admission Student ${uid("a")}`,
    grade: "10th Grade",
    guardianName: "Fictional Guardian",
    whatsappNumber: "+91 98470 22222",
    country: "India",
    enrolments: [{ subjectId, teacherId }],
    initialPackage: { totalCredits: 12, price: 0, startDate: today(), allocations: [{ subjectId, allocatedCredits: 12 }] },
    slots,
    ...extra,
  };
}

async function counts() {
  const [students, guardians, packages, invoices, slots, sessions] = await Promise.all([
    prisma.student.count(),
    prisma.guardian.count(),
    prisma.studentPackage.count(),
    prisma.invoice.count(),
    prisma.timetableSlot.count(),
    prisma.session.count(),
  ]);
  return { students, guardians, packages, invoices, slots, sessions };
}

describe("admission", () => {
  test("weekly slots are validated and the first weeks are booked in the same transaction", async () => {
    const subject = await makeSubject("Chemistry");
    const trainer = await makeTeacher("Admission Chemistry");
    const body = admission(subject.id, trainer.id, [
      { subjectId: subject.id, weekday: 1, start: "17:00", end: "18:00" },
      { subjectId: subject.id, weekday: 4, start: "17:00", end: "18:00" },
    ]);
    const { result, booking } = await createStudent(parseStudentFields(body, { partial: false }), coordinator, null);
    assert.equal(booking?.weeklySlots, 2);
    assert.ok((booking?.bookedClasses ?? 0) >= 6, `booked ${booking?.bookedClasses}`);
    const slots = await prisma.timetableSlot.findMany({ where: { enrolment: { studentId: result.id } } });
    assert.equal(slots.length, 2);
    assert.ok(slots.every((s) => s.timeZone === "Asia/Kolkata" && s.teacherId === trainer.id));
    const sessions = await prisma.session.count({ where: { studentId: result.id, status: "SCHEDULED", isCreditReserved: true } });
    assert.equal(sessions, booking?.bookedClasses);
  });

  test("a trainer clash is refused with the clash explained, and nothing at all is saved", async () => {
    const subject = await makeSubject("Physics");
    const trainer = await makeTeacher("Admission Physics");
    await createStudent(
      parseStudentFields(admission(subject.id, trainer.id, [{ subjectId: subject.id, weekday: 2, start: "18:00", end: "19:00" }]), { partial: false }),
      coordinator,
      null
    );
    const before = await counts();
    const clashing = admission(subject.id, trainer.id, [{ subjectId: subject.id, weekday: 2, start: "18:30", end: "19:30" }]);
    const errors = await expectFieldError(createStudent(parseStudentFields(clashing, { partial: false }), coordinator, null), (f) => Boolean(f["slots.0.start"]));
    assert.match(errors["slots.0.start"], /already teaches/);
    assert.deepEqual(await counts(), before, "no student, guardian, package, invoice, slot or class was created");
  });

  test("check-only runs every check and saves nothing", async () => {
    const subject = await makeSubject("Biology");
    const trainer = await makeTeacher("Admission Biology");
    const before = await counts();
    const { booking } = await checkAdmission(
      parseStudentFields(admission(subject.id, trainer.id, [{ subjectId: subject.id, weekday: 3, start: "16:00", end: "17:00" }], { initialPackage: { totalCredits: 8, price: 4000, startDate: today(), allocations: [{ subjectId: subject.id, allocatedCredits: 8 }] } }), { partial: false }),
      owner
    );
    assert.equal(booking?.weeklySlots, 1);
    assert.ok((booking?.bookedClasses ?? 0) >= 3);
    assert.deepEqual(await counts(), before);
  });

  test("overlapping slots for the same student, bad times and missing subjects get field errors (not a crash)", async () => {
    const subject = await makeSubject("English");
    const trainer = await makeTeacher("Admission English");
    const overlap = admission(subject.id, trainer.id, [
      { subjectId: subject.id, weekday: 5, start: "10:00", end: "11:00" },
      { subjectId: subject.id, weekday: 5, start: "10:30", end: "11:30" },
    ]);
    await expectFieldError(createStudent(parseStudentFields(overlap, { partial: false }), coordinator, null), (f) => /Overlaps/.test(f["slots.1.start"] ?? ""));
    const garbage = admission(subject.id, trainer.id, [{ subjectId: subject.id, weekday: 9, start: "abc", end: 7 }]);
    await expectFieldError(createStudent(parseStudentFields(garbage, { partial: false }), coordinator, null), (f) => Boolean(f["slots.0.weekday"] && f["slots.0.start"]));
    const notEnrolled = admission(subject.id, trainer.id, [{ subjectId: "not-a-subject", weekday: 1, start: "09:00", end: "10:00" }]);
    await expectFieldError(createStudent(parseStudentFields(notEnrolled, { partial: false }), coordinator, null), (f) => Boolean(f["slots.0.enrolmentId"]));
  });

  test("students cannot be saved as placeholder drafts any more", () => {
    assert.throws(() => parseStudentFields({ status: "DRAFT", name: "" }, { partial: false }), (e: unknown) => e instanceof ApiError && e.status === 400);
  });
});

describe("admission drafts", () => {
  test("drafts store the form only, refuse stale overwrites, and confirming removes the draft", async () => {
    const subject = await makeSubject("Maths");
    const trainer = await makeTeacher("Draft Maths");
    const studentsBefore = await prisma.student.count();
    const guardiansBefore = await prisma.guardian.count();

    const draft = await createDraft({ data: { name: "Draft Kid", step: 2 } }, coordinator);
    assert.equal(draft.label, "Draft Kid");
    assert.equal(await prisma.student.count(), studentsBefore, "a draft creates no student");
    assert.equal(await prisma.guardian.count(), guardiansBefore, "a draft creates no guardian");

    const saved = await updateDraft(draft.id, { data: { name: "Draft Kid", step: 3 }, baseUpdatedAt: draft.updatedAt }, coordinator);
    await assert.rejects(
      updateDraft(draft.id, { data: { name: "Someone else's version", step: 1 }, baseUpdatedAt: draft.updatedAt }, owner),
      (e: unknown) => e instanceof ApiError && e.status === 409
    );
    assert.equal(JSON.parse((await prisma.admissionDraft.findUniqueOrThrow({ where: { id: draft.id } })).data).step, 3, "the newer save was kept");

    const body = admission(subject.id, trainer.id, [{ subjectId: subject.id, weekday: 6, start: "11:00", end: "12:00" }], { draftId: saved.id });
    await createStudent(parseStudentFields(body, { partial: false }), coordinator, null);
    assert.equal(await prisma.admissionDraft.findUnique({ where: { id: draft.id } }), null, "confirmed draft removed");

    const other = await createDraft({ data: {} }, coordinator);
    assert.equal(other.label, "Untitled admission");
    await deleteDraft(other.id, coordinator);
    await assert.rejects(deleteDraft(other.id, coordinator), (e: unknown) => e instanceof ApiError && e.status === 404);
  });
});
