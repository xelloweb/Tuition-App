/**
 * Submitted attendance is locked: trainers ask for corrections, staff apply the
 * audited correction (which resolves the request) or decline it.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, coordinator, makeSubject, makeTeacher, makeStudent, enrol, makePackage } from "./helpers";
import { correctAttendanceRecord, submitSessionAttendance } from "../src/lib/attendance-ledger";
import { createCorrectionRequest, declineCorrectionRequest, listCorrectionRequests } from "../src/lib/services/correction-requests";
import { ApiError } from "../src/lib/api-errors";
import type { CurrentUser } from "../src/lib/types";

const isStatus = (status: number) => (e: unknown) => e instanceof ApiError && e.status === status;

async function submittedClass() {
  const subject = await makeSubject("Physics");
  const teacher = await makeTeacher("Correction Physics");
  const other = await makeTeacher("Correction Other");
  const student = await makeStudent();
  await enrol(student.id, subject.id, teacher.id);
  const pkg = await makePackage(student.id, [{ subjectId: subject.id, credits: 10 }]);
  const start = new Date(Date.now() - 3 * 3600 * 1000);
  const session = await prisma.session.create({
    data: {
      packageId: pkg.id, studentId: student.id, teacherId: teacher.id, subjectId: subject.id,
      scheduledStartTimeUtc: start, scheduledEndTimeUtc: new Date(start.getTime() + 3600000), durationMinutes: 60,
      status: "SCHEDULED", isCreditReserved: true,
    },
  });
  const trainer: CurrentUser = { id: `u-${teacher.id}`, name: teacher.name, email: teacher.email, role: "TEACHER", teacherId: teacher.id };
  const otherTrainer: CurrentUser = { id: `u-${other.id}`, name: other.name, email: other.email, role: "TEACHER", teacherId: other.id };
  const result = await submitSessionAttendance({
    sessionId: session.id, sessionOutcome: "COMPLETED", studentAttendance: "PRESENT", actualDurationMinutes: 60, topicCovered: "Optics", user: trainer,
  });
  return { recordId: result.attendanceId!, trainer, otherTrainer, packageId: pkg.id };
}

describe("attendance correction requests", () => {
  test("only the trainer who taught the class can ask, once at a time", async () => {
    const { recordId, trainer, otherTrainer } = await submittedClass();
    await assert.rejects(createCorrectionRequest(recordId, { reason: "Student was absent" }, otherTrainer), isStatus(403));
    await assert.rejects(createCorrectionRequest(recordId, { reason: "Student was absent" }, coordinator), isStatus(403));
    await assert.rejects(createCorrectionRequest(recordId, { reason: "no" }, trainer), isStatus(400));
    const req = await createCorrectionRequest(recordId, { reason: "Student was absent, I marked present by mistake", requestedOutcome: "STUDENT_NO_SHOW", requestedAttendance: "ABSENT" }, trainer);
    assert.equal(req.status, "OPEN");
    await assert.rejects(createCorrectionRequest(recordId, { reason: "Second try at this" }, trainer), isStatus(409));
    const mine = await listCorrectionRequests(trainer);
    assert.ok(mine.some((r) => r.id === req.id));
    assert.ok(!(await listCorrectionRequests(otherTrainer)).some((r) => r.id === req.id), "other trainers do not see it");
  });

  test("the audited correction resolves the open request and moves the credit back", async () => {
    const { recordId, trainer, packageId } = await submittedClass();
    const req = await createCorrectionRequest(recordId, { reason: "Trainer could not join, class did not happen", requestedOutcome: "TEACHER_NO_SHOW" }, trainer);
    const usedBefore = await prisma.session.count({ where: { packageId, isCreditConsumed: true } });
    await correctAttendanceRecord(recordId, "TEACHER_NO_SHOW", "PRESENT", "Confirmed with the trainer", coordinator);
    const after = await prisma.attendanceCorrectionRequest.findUniqueOrThrow({ where: { id: req.id } });
    assert.equal(after.status, "RESOLVED");
    assert.equal(after.resolvedByName, coordinator.name);
    assert.equal(await prisma.session.count({ where: { packageId, isCreditConsumed: true } }), usedBefore - 1, "the class credit was returned");
  });

  test("staff can decline with a note; it cannot be handled twice; trainers cannot decline", async () => {
    const { recordId, trainer } = await submittedClass();
    const req = await createCorrectionRequest(recordId, { reason: "Wrong attendance, student came late" }, trainer);
    await assert.rejects(declineCorrectionRequest(req.id, { note: "No" }, trainer), isStatus(403));
    await assert.rejects(declineCorrectionRequest(req.id, { note: "" }, coordinator), isStatus(400));
    const declined = await declineCorrectionRequest(req.id, { note: "The class log shows the student on time." }, coordinator);
    assert.equal(declined.status, "DECLINED");
    await assert.rejects(declineCorrectionRequest(req.id, { note: "Again" }, coordinator), isStatus(409));
    // A new request is allowed once the previous one is closed.
    const again = await createCorrectionRequest(recordId, { reason: "Asking again with the parent's message" }, trainer);
    assert.equal(again.status, "OPEN");
  });

  test("an empty topic is stored as \"Not recorded\", never an invented one", async () => {
    const { parseAttendanceBody } = await import("../src/lib/attendance-ledger");
    assert.equal(parseAttendanceBody({ sessionOutcome: "COMPLETED", studentAttendance: "PRESENT" }).topicCovered, "Not recorded");
  });
});
