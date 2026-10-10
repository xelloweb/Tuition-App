import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { prisma, owner, coordinator, makeSubject, makeTeacher, makePackage, uid, expectFieldError } from "./helpers";
import { createTeacher, deleteTeacher, parseTeacherFields, updateTeacher } from "../src/lib/services/teachers";
import {
  createStudent,
  deleteStudent,
  findGuardiansByPhone,
  parseStudentFields,
  updateStudent,
} from "../src/lib/services/students";
import { ApiError } from "../src/lib/api-errors";
import { parseGradeRates } from "../src/lib/rates";

const trainerBody = (overrides: Record<string, unknown> = {}) => ({
  name: `Anand K. ${uid("t")}`,
  email: `${uid("anand")}@Example.test`,
  phone: "+91 98470 12345",
  subjects: ["Mathematics", "Physics"],
  grades: ["Plus One (+1 / 11th)"],
  country: "India",
  timeZone: "Asia/Kolkata",
  ...overrides,
});

async function newTrainer(overrides: Record<string, unknown> = {}, user = owner, key: string | null = null) {
  const fields = parseTeacherFields(trainerBody(overrides), { partial: false, user });
  return createTeacher(fields, user, key);
}

async function newStudent(body: Record<string, unknown>, key: string | null = null) {
  return createStudent(parseStudentFields(body, { partial: false }), coordinator, key);
}

describe("trainer creation", () => {
  test("owner creates a trainer with pay rates; email is normalised and rates stored per tier", async () => {
    const { teacher, replayed } = await newTrainer({ defaultRate: 600, gradeRates: { PLUS_ONE: 700 } });
    assert.equal(replayed, false);
    assert.equal(teacher.email, teacher.email.toLowerCase());
    const row = await prisma.teacher.findUniqueOrThrow({ where: { id: teacher.id } });
    assert.equal(row.defaultRate, 600);
    assert.deepEqual(parseGradeRates(row.gradeRates), { PLUS_ONE: 700 });
    assert.equal(await prisma.user.count({ where: { teacherId: teacher.id } }), 0, "no login account is created");
  });

  test("coordinator creates a trainer profile but cannot set pay rates", async () => {
    const { teacher } = await newTrainer({}, coordinator);
    assert.equal(teacher.defaultRate, null, "rates hidden from coordinator");
    const row = await prisma.teacher.findUniqueOrThrow({ where: { id: teacher.id } });
    assert.equal(row.defaultRate, 500, "schema default applied");
    assert.throws(() => parseTeacherFields(trainerBody({ defaultRate: 900 }), { partial: false, user: coordinator }), (e: ApiError) => e.status === 403);
  });

  test("duplicate email (any letter case) is rejected with a field error", async () => {
    const email = `${uid("dup")}@example.test`;
    await newTrainer({ email });
    await expectFieldError(newTrainer({ email: email.toUpperCase() }), (fe) => /already used/.test(fe.email ?? ""));
  });

  test("invalid email, phone and empty subjects are reported per field", async () => {
    assert.throws(
      () => parseTeacherFields(trainerBody({ email: "not-an-email", phone: "12345", subjects: [] }), { partial: false, user: owner }),
      (e: ApiError) => Boolean(e.fieldErrors?.email && e.fieldErrors?.phone && e.fieldErrors?.subjects)
    );
    assert.throws(
      () => parseTeacherFields(trainerBody({ phone: "+971 501 234" }), { partial: false, user: owner }),
      (e: ApiError) => /UAE numbers need/.test(e.fieldErrors?.phone ?? "")
    );
  });

  test("a retried submission with the same idempotency key does not create a duplicate", async () => {
    const key = uid("idem-trainer-key");
    const body = trainerBody();
    const first = await createTeacher(parseTeacherFields(body, { partial: false, user: owner }), owner, key);
    const again = await createTeacher(parseTeacherFields(body, { partial: false, user: owner }), owner, key);
    assert.equal(again.replayed, true);
    assert.equal(again.teacher.id, first.teacher.id);
    const concurrent = await Promise.allSettled([1, 2, 3].map(() =>
      createTeacher(parseTeacherFields(trainerBody({ email: `${uid("race")}@example.test` }), { partial: false, user: owner }), owner, `${key}-race`)
    ));
    const ids = new Set(concurrent.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ teacher: { id: string } }>).value.teacher.id));
    assert.equal(ids.size, 1, "concurrent double-clicks resolve to one trainer");
  });

  test("a trainer with history cannot be deleted but can be deactivated", async () => {
    const { teacher } = await newTrainer();
    const subject = await makeSubject("Physics");
    const student = await newStudent({
      name: "History Student", grade: "10th Grade", guardianName: "P", whatsappNumber: "+91 98765 43210",
      enrolments: [{ subjectId: subject.id, teacherId: teacher.id }],
    });
    await assert.rejects(deleteTeacher(teacher.id, owner), (e: ApiError) => e.code === "HAS_HISTORY");
    const { teacher: updated, warning } = await updateTeacher(teacher.id, { active: false }, owner);
    assert.equal(updated.active, false);
    assert.match(warning ?? "", /1 student enrolment/);
    assert.ok(await prisma.student.findUnique({ where: { id: student.result.id } }), "student untouched");
  });
});

describe("student creation", () => {
  let maths: { id: string }, arabic: { id: string };
  let trainer: { id: string };
  before(async () => {
    maths = await makeSubject("Mathematics");
    arabic = await makeSubject("Arabic");
    trainer = await makeTeacher("Student Flow Trainer");
  });

  const base = (overrides: Record<string, unknown> = {}) => ({
    name: `Farhan ${uid("s")}`,
    grade: "10th Grade",
    board: "CBSE",
    medium: "English",
    guardianName: "Basheer Ahmed",
    whatsappNumber: "+971 50 123 4567",
    country: "UAE",
    timeZone: "Asia/Dubai",
    ...overrides,
  });

  test("one subject, no trainer yet, no package, no email", async () => {
    const { result } = await newStudent(base({ enrolments: [{ subjectId: maths.id, teacherId: null }] }));
    assert.match(result.studentCode, /^XEL-\d{4}-\d{3,}$/);
    assert.equal(result.email, null);
    assert.equal(result.enrolments.length, 1);
    assert.equal(result.enrolments[0].teacherId, null);
    assert.equal(await prisma.studentPackage.count({ where: { studentId: result.id } }), 0);
    assert.equal(await prisma.invoice.count({ where: { studentId: result.id } }), 0);
  });

  test("preferred class days are saved on admission and edit, book nothing, and leave an earlier timing note alone", async () => {
    const { result } = await newStudent(
      base({ enrolments: [{ subjectId: maths.id, teacherId: trainer.id }], preferredDays: [5, 1, "3"], preferredTimings: "Weekdays after 6 PM IST" })
    );
    const saved = await prisma.student.findUniqueOrThrow({ where: { id: result.id } });
    assert.equal(saved.preferredDays, "[1,3,5]", "Monday, Wednesday, Friday");
    assert.equal(saved.preferredTimings, "Weekdays after 6 PM IST");
    assert.equal(await prisma.timetableSlot.count({ where: { enrolment: { studentId: result.id } } }), 0, "days alone create no weekly slots");
    assert.equal(await prisma.session.count({ where: { studentId: result.id } }), 0, "and no classes");

    await updateStudent(result.id, parseStudentFields({ preferredDays: [0, 6] }, { partial: true }), coordinator);
    let edited = await prisma.student.findUniqueOrThrow({ where: { id: result.id } });
    assert.equal(edited.preferredDays, "[6,0]");
    assert.equal(edited.preferredTimings, "Weekdays after 6 PM IST", "the earlier note is kept");

    // An edit that does not send days (an older screen) leaves them as they are.
    await updateStudent(result.id, parseStudentFields({ learningGoals: "Algebra" }, { partial: true }), coordinator);
    edited = await prisma.student.findUniqueOrThrow({ where: { id: result.id } });
    assert.equal(edited.preferredDays, "[6,0]");

    await updateStudent(result.id, parseStudentFields({ preferredDays: [] }, { partial: true }), coordinator);
    assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: result.id } })).preferredDays, null, "all days cleared");

    await expectFieldError(newStudent(base({ preferredDays: [9] })), (fe) => /Monday to Sunday/.test(fe.preferredDays ?? ""));
    // Students saved before this change have no days: none is not an error.
    assert.equal((await newStudent(base())).result.preferredDays, null);
  });

  test("multiple subjects with a package create allocations, ledger entries and an invoice", async () => {
    const { result } = await newStudent(
      base({
        whatsappNumber: "+91 98470 55555",
        country: "India",
        timeZone: "Asia/Kolkata",
        enrolments: [
          { subjectId: maths.id, teacherId: trainer.id },
          { subjectId: arabic.id, teacherId: null },
        ],
        initialPackage: {
          totalCredits: 20,
          price: 18000,
          startDate: "2026-10-07",
          allocations: [
            { subjectId: maths.id, allocatedCredits: 10 },
            { subjectId: arabic.id, allocatedCredits: 10 },
          ],
        },
      })
    );
    const pkg = await prisma.studentPackage.findFirstOrThrow({ where: { studentId: result.id }, include: { allocations: true } });
    assert.equal(pkg.totalCredits, 20);
    assert.equal(pkg.allocations.length, 2);
    assert.equal(await prisma.creditLedger.count({ where: { packageId: pkg.id, eventType: "PURCHASE_INITIAL" } }), 2);
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { studentId: result.id } });
    assert.equal(invoice.totalAmount, 18000);
    assert.equal(invoice.balanceDue, 18000);
  });

  test("India and GCC numbers are accepted; prefix-only and malformed numbers are rejected", async () => {
    for (const [phone, country] of [["+91 94471 88201", "India"], ["+966 55 123 4567", "Saudi Arabia"], ["+974 3312 3456", "Qatar"], ["+968 9123 4567", "Oman"], ["+965 9988 7766", "Kuwait"], ["+973 3612 3456", "Bahrain"]]) {
      const { result } = await newStudent(base({ whatsappNumber: phone, country }));
      assert.equal(result.whatsappNumber, phone);
    }
    assert.throws(() => parseStudentFields(base({ whatsappNumber: "+971 " }), { partial: false }), (e: ApiError) => Boolean(e.fieldErrors?.whatsappNumber));
    assert.throws(() => parseStudentFields(base({ whatsappNumber: "0501234567" }), { partial: false }), (e: ApiError) => /Start with \+/.test(e.fieldErrors?.whatsappNumber ?? ""));
  });

  test("siblings: an explicitly linked guardian is shared; a matching phone alone never merges families", async () => {
    const phone = "+971 55 765 4321";
    const first = await newStudent(base({ whatsappNumber: phone, guardianName: "Shared Parent" }));
    const separate = await newStudent(base({ whatsappNumber: "+971 557654321", guardianName: "Different Family" }));
    assert.notEqual(separate.result.guardianId, first.result.guardianId, "no silent merge on phone match");

    const matches = await findGuardiansByPhone("+971557654321");
    assert.ok(matches.some((g) => g.id === first.result.guardianId), "lookup finds guardians regardless of spacing");

    const sibling = await newStudent({ ...base({ guardianId: first.result.guardianId }), guardianName: undefined, whatsappNumber: undefined });
    assert.equal(sibling.result.guardianId, first.result.guardianId);
    assert.equal(sibling.result.guardianName, "Shared Parent");

    // Editing the shared guardian updates every linked child.
    await updateStudent(sibling.result.id, parseStudentFields({ guardianName: "Shared Parent (Mother)" }, { partial: true }), coordinator);
    const firstAfter = await prisma.student.findUniqueOrThrow({ where: { id: first.result.id } });
    assert.equal(firstAfter.guardianName, "Shared Parent (Mother)");
  });

  test("missing subject or inactive trainer fails cleanly and leaves no partial records", async () => {
    const before = await Promise.all([prisma.student.count(), prisma.guardian.count(), prisma.subjectEnrollment.count()]);
    await expectFieldError(
      newStudent(base({ enrolments: [{ subjectId: "sub-does-not-exist", teacherId: null }] })),
      (fe) => /no longer exists/.test(fe["enrolments.0.subjectId"] ?? "")
    );
    const inactive = await makeTeacher("Inactive Trainer", { active: false });
    await expectFieldError(
      newStudent(base({ enrolments: [{ subjectId: maths.id, teacherId: inactive.id }] })),
      (fe) => /inactive/.test(fe["enrolments.0.teacherId"] ?? "")
    );
    const after = await Promise.all([prisma.student.count(), prisma.guardian.count(), prisma.subjectEnrollment.count()]);
    assert.deepEqual(after, before, "transaction rolled back completely");
  });

  test("package allocations must match enrolled subjects and the package total", async () => {
    assert.throws(
      () => parseStudentFields(base({ enrolments: [{ subjectId: maths.id }], initialPackage: { totalCredits: 10, price: 0, allocations: [{ subjectId: arabic.id, allocatedCredits: 5 }] } }), { partial: false }),
      (e: ApiError) => /enrolled in/.test(e.fieldErrors?.["package.allocations.0.subjectId"] ?? "")
    );
    assert.throws(
      () => parseStudentFields(base({ enrolments: [{ subjectId: maths.id }], initialPackage: { totalCredits: 10, price: 0, allocations: [{ subjectId: maths.id, allocatedCredits: 12 }] } }), { partial: false }),
      (e: ApiError) => /exceed/.test(e.fieldErrors?.["package.totalCredits"] ?? "")
    );
  });

  test("student IDs are never reused after a deletion and stay unique under concurrent creation", async () => {
    const a = await newStudent(base());
    const b = await newStudent(base());
    await deleteStudent(a.result.id, coordinator); // no history: deletable
    const c = await newStudent(base());
    const seq = (code: string) => Number(code.split("-").pop());
    assert.ok(seq(c.result.studentCode) > seq(b.result.studentCode), "code continues after the highest, not the count");

    const many = await Promise.all([1, 2, 3, 4, 5].map(() => newStudent(base())));
    const codes = many.map((m) => m.result.studentCode);
    assert.equal(new Set(codes).size, 5, `unique codes: ${codes.join(", ")}`);
  });

  test("double submission with the same key creates one student", async () => {
    const key = uid("idem-student-key");
    const body = base({ name: "Double Click Student" });
    const results = await Promise.all([newStudent(body, key), newStudent(body, key)]);
    assert.equal(results[0].result.id, results[1].result.id);
    assert.equal(await prisma.student.count({ where: { name: "Double Click Student" } }), 1);
  });

  test("students with history are archived, not deleted", async () => {
    const { result } = await newStudent(base({ enrolments: [{ subjectId: maths.id, teacherId: trainer.id }] }));
    await makePackage(result.id, [{ subjectId: maths.id, credits: 5 }]);
    await assert.rejects(deleteStudent(result.id, coordinator), (e: ApiError) => e.code === "HAS_HISTORY");
    const { student } = await updateStudent(result.id, parseStudentFields({ status: "WITHDRAWN" }, { partial: true }), coordinator);
    assert.equal(student.status, "WITHDRAWN");
  });
});
