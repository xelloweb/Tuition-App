/**
 * Parent submissions: an enquiry never creates a student, package, invoice,
 * class or reservation; retries do not duplicate; siblings may share a number;
 * staff convert a submission through the normal admission exactly once.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, coordinator, owner, makeSubject, makeTeacher, uid } from "./helpers";
import { IntakeData } from "../src/lib/intake";
import {
  addSubmissionNote,
  createParentSubmission,
  getSubmissionDetail,
  listSubmissions,
  updateSubmission,
} from "../src/lib/services/parent-submissions";
import { checkAdmission, createStudent, parseStudentFields } from "../src/lib/services/students";
import { createDraft, deleteDraft } from "../src/lib/services/admission-drafts";
import { ApiError } from "../src/lib/api-errors";

const today = () => new Date().toISOString().slice(0, 10);
/** A fictional UAE mobile in the stored format, different for every call. */
const freshPhone = () => `+971 5${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

function intake(subjectIds: string[], extra: Partial<IntakeData> = {}): IntakeData {
  return {
    studentName: `Intake Student ${uid("s")}`,
    grade: "8th Grade",
    board: "CBSE",
    schoolName: null,
    medium: "English",
    subjectIds,
    guardianName: "Fictional Parent",
    relationship: "Father",
    whatsappNumber: freshPhone(),
    altPhone: null,
    email: null,
    country: "UAE",
    city: "Dubai",
    helpAreas: "Fractions",
    teachingLanguage: null,
    startDate: null,
    notes: null,
    preferences: [{ subjectId: subjectIds[0], weekday: 2, start: "18:00", end: "19:00" }],
    consent: true,
    ...extra,
  };
}

async function counts() {
  const [students, guardians, packages, invoices, slots, sessions, ledger, attendance] = await Promise.all([
    prisma.student.count(),
    prisma.guardian.count(),
    prisma.studentPackage.count(),
    prisma.invoice.count(),
    prisma.timetableSlot.count(),
    prisma.session.count(),
    prisma.creditLedger.count(),
    prisma.attendanceRecord.count(),
  ]);
  return { students, guardians, packages, invoices, slots, sessions, ledger, attendance };
}

function admissionBody(name: string, subjectId: string, teacherId: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    grade: "8th Grade",
    guardianName: "Fictional Parent",
    whatsappNumber: "+971 501234567",
    country: "UAE",
    enrolments: [{ subjectId, teacherId }],
    initialPackage: { totalCredits: 12, price: 0, startDate: today(), allocations: [{ subjectId, allocatedCredits: 12 }] },
    slots: [],
    ...extra,
  };
}

async function expectApiError(promise: Promise<unknown>, status: number, pattern?: RegExp) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof ApiError, String(err));
    assert.equal(err.status, status, err.message);
    if (pattern) assert.match(err.message, pattern);
    return true;
  });
}

describe("parent submissions", () => {
  test("a submission alone creates no student, guardian, package, invoice, class, reservation or attendance", async () => {
    const subject = await makeSubject("Maths");
    const before = await counts();
    const { reference, replayed } = await createParentSubmission(intake([subject.id]), uid("key-aaaaaaaaaaaa"));
    assert.equal(replayed, false);
    assert.deepEqual(await counts(), before);

    const row = await prisma.parentSubmission.findUniqueOrThrow({ where: { reference } });
    assert.equal(row.status, "NEW");
    assert.equal(row.subjectNames, subject.name);
    assert.match(row.whatsappKey, /^971\d{9}$/);
    const stored = JSON.parse(row.submittedData);
    assert.equal(stored.timeZone, "Asia/Kolkata");
    assert.equal(stored.preferences[0].subjectName, subject.name, "preferred times keep the subject name");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: row.id, action: "PARENT_FORM_SUBMITTED" } });
    assert.doesNotMatch(audit.details, /Fictional Parent|971/, "no personal details in the audit trail");
  });

  test("a retried submission returns the same reference instead of a duplicate", async () => {
    const subject = await makeSubject("Physics");
    const key = uid("retry-key-bbbbbbbbbb");
    const data = intake([subject.id]);
    const first = await createParentSubmission(data, key);
    const again = await createParentSubmission(data, key);
    assert.equal(again.reference, first.reference);
    assert.equal(again.replayed, true);
    const [a, b] = await Promise.all([createParentSubmission(data, `${key}-x`), createParentSubmission(data, `${key}-x`)]);
    assert.equal(a.reference, b.reference, "two simultaneous retries still produce one submission");
    assert.equal(await prisma.parentSubmission.count({ where: { submissionKey: { in: [key, `${key}-x`] } } }), 2);
  });

  test("siblings can share the parent's number; the same child twice is flagged, never rejected or merged", async () => {
    const subject = await makeSubject("English");
    const phone = freshPhone();
    await createParentSubmission(intake([subject.id], { whatsappNumber: phone, studentName: "Sibling One" }), uid("sib-1-ccccccccccc"));
    const second = await createParentSubmission(intake([subject.id], { whatsappNumber: phone, studentName: "Sibling Two" }), uid("sib-2-ccccccccccc"));
    const repeat = await createParentSubmission(intake([subject.id], { whatsappNumber: phone, studentName: "Sibling Two" }), uid("sib-3-ccccccccccc"));
    assert.notEqual(second.reference, repeat.reference, "accepted as its own submission");

    const list = await listSubmissions(coordinator, { status: "ALL", q: phone.replace(/\D/g, "").slice(-7) });
    const flagged = list.items.filter((i) => i.flags.includes("Possible duplicate")).map((i) => i.studentName).sort();
    assert.deepEqual(flagged, ["Sibling Two", "Sibling Two"]);
    assert.equal(list.items.find((i) => i.studentName === "Sibling One")?.flags.includes("Possible duplicate"), false);

    const detail = await getSubmissionDetail((await prisma.parentSubmission.findUniqueOrThrow({ where: { reference: second.reference } })).id);
    assert.equal(detail!.matches.otherSubmissions.length, 2);
    assert.equal(detail!.matches.otherSubmissions.filter((o) => o.sameName).length, 1);
  });

  test("staff search, status, assignment, follow-up and notes; Converted cannot be set by hand", async () => {
    const subject = await makeSubject("Biology");
    const { reference } = await createParentSubmission(intake([subject.id], { studentName: "Searchable Pupil" }), uid("staff-ddddddddddd"));
    const id = (await prisma.parentSubmission.findUniqueOrThrow({ where: { reference } })).id;
    assert.ok((await listSubmissions(coordinator, { q: "Searchable" })).items.some((i) => i.id === id));
    assert.ok((await listSubmissions(coordinator, { q: reference.toLowerCase() })).items.some((i) => i.id === id));

    const updated = await updateSubmission(id, { status: "CONTACTED", assignedToUserId: coordinator.id, followUpOn: "2026-10-12" }, owner);
    assert.equal(updated!.status, "CONTACTED");
    assert.equal(updated!.assignedToName, coordinator.name);
    assert.equal(updated!.followUpOn, "2026-10-12");
    assert.ok((await listSubmissions(coordinator, { assigned: "ME" })).items.some((i) => i.id === id));

    await expectApiError(updateSubmission(id, { status: "CONVERTED" }, owner), 400);
    await expectApiError(updateSubmission(id, { assignedToUserId: "usr-accounts" }, owner), 400);
    await expectApiError(updateSubmission(id, { followUpOn: "12/10/2026" }, owner), 400);

    const withNote = await addSubmissionNote(id, { body: "Called the parent; sending the timetable." }, coordinator);
    assert.equal(withNote!.notes[0].body, "Called the parent; sending the timetable.");
    await expectApiError(addSubmissionNote(id, { body: "   " }, coordinator), 400);
    const audits = await prisma.auditLog.findMany({ where: { entityId: id } });
    assert.ok(audits.some((a) => a.action === "UPDATE_PARENT_SUBMISSION" && a.details.includes("CONTACTED")));
    assert.ok(audits.some((a) => a.action === "NOTE_PARENT_SUBMISSION"));
  });

  test("confirming the admission converts the submission once; a second conversion is refused and saves nothing", async () => {
    const subject = await makeSubject("Chemistry");
    const trainer = await makeTeacher("Intake Chemistry");
    const { reference } = await createParentSubmission(intake([subject.id]), uid("convert-eeeeeeeeee"));
    const submission = await prisma.parentSubmission.findUniqueOrThrow({ where: { reference } });

    const fields = parseStudentFields(admissionBody(uid("Converted Pupil"), subject.id, trainer.id, { submissionId: submission.id }), { partial: false });
    await checkAdmission(fields, coordinator);
    assert.equal((await prisma.parentSubmission.findUniqueOrThrow({ where: { id: submission.id } })).status, "NEW", "the pre-review check converts nothing");

    const { result } = await createStudent(fields, coordinator, uid("idem-conv-1"));
    const after = await prisma.parentSubmission.findUniqueOrThrow({ where: { id: submission.id } });
    assert.equal(after.status, "CONVERTED");
    assert.equal(after.convertedStudentId, result.id);
    assert.equal(after.convertedByName, coordinator.name);

    const before = await counts();
    const again = parseStudentFields(admissionBody(uid("Second Pupil"), subject.id, trainer.id, { submissionId: submission.id }), { partial: false });
    await expectApiError(createStudent(again, owner, uid("idem-conv-2")), 409, /already converted/);
    assert.deepEqual(await counts(), before, "the refused admission saved nothing");
    await expectApiError(updateSubmission(submission.id, { status: "NEW" }, owner), 409);
  });

  test("two staff confirming at the same moment produce exactly one admission", async () => {
    const subject = await makeSubject("History");
    const trainer = await makeTeacher("Intake History");
    const { reference } = await createParentSubmission(intake([subject.id]), uid("race-ffffffffffff"));
    const submission = await prisma.parentSubmission.findUniqueOrThrow({ where: { reference } });
    const name = uid("Race Pupil");
    const attempt = (who: typeof owner, key: string) =>
      createStudent(parseStudentFields(admissionBody(name, subject.id, trainer.id, { submissionId: submission.id }), { partial: false }), who, key);
    const results = await Promise.allSettled([attempt(owner, uid("race-1")), attempt(coordinator, uid("race-2"))]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(results.map((r) => r.status)));
    assert.equal(await prisma.student.count({ where: { name } }), 1);
  });

  test("an admission draft started from a submission is linked once, resumed and converted through the draft", async () => {
    const subject = await makeSubject("Geography");
    const trainer = await makeTeacher("Intake Geography");
    const { reference } = await createParentSubmission(intake([subject.id]), uid("draft-gggggggggggg"));
    const submission = await prisma.parentSubmission.findUniqueOrThrow({ where: { reference } });

    const draft = await createDraft({ data: { name: "Draft From Intake" }, submissionId: submission.id }, coordinator);
    assert.equal(draft.submission?.reference, reference);
    assert.equal(draft.submission?.preferences[0].start, "18:00");
    assert.equal((await prisma.parentSubmission.findUniqueOrThrow({ where: { id: submission.id } })).admissionDraftId, draft.id);
    await expectApiError(createDraft({ data: { name: "Second draft" }, submissionId: submission.id }, owner), 409, /already has an admission draft/);
    assert.equal(await prisma.admissionDraft.count({ where: { label: "Second draft" } }), 0, "the refused draft was not kept");

    // Confirming through the draft converts the submission even without sending its id again.
    const fields = parseStudentFields(admissionBody(uid("Drafted Pupil"), subject.id, trainer.id, { draftId: draft.id }), { partial: false });
    const { result } = await createStudent(fields, coordinator, uid("idem-draft"));
    const after = await prisma.parentSubmission.findUniqueOrThrow({ where: { id: submission.id } });
    assert.equal(after.status, "CONVERTED");
    assert.equal(after.convertedStudentId, result.id);
    assert.equal(after.admissionDraftId, null);
    assert.equal(await prisma.admissionDraft.count({ where: { id: draft.id } }), 0);
  });

  test("deleting a linked draft frees the submission for a new start", async () => {
    const subject = await makeSubject("Hindi");
    const { reference } = await createParentSubmission(intake([subject.id]), uid("deldraft-hhhhhhhhh"));
    const submission = await prisma.parentSubmission.findUniqueOrThrow({ where: { reference } });
    const draft = await createDraft({ data: { name: "Throwaway" }, submissionId: submission.id }, coordinator);
    await deleteDraft(draft.id, coordinator);
    assert.equal((await prisma.parentSubmission.findUniqueOrThrow({ where: { id: submission.id } })).admissionDraftId, null);
    const again = await createDraft({ data: { name: "Fresh start" }, submissionId: submission.id }, coordinator);
    assert.equal(again.submission?.id, submission.id);
  });

  test("staff can link a submission to an existing student without converting it", async () => {
    const subject = await makeSubject("Malayalam");
    const existing = await prisma.student.findFirstOrThrow();
    const { reference } = await createParentSubmission(intake([subject.id]), uid("link-iiiiiiiiiiii"));
    const submission = await prisma.parentSubmission.findUniqueOrThrow({ where: { reference } });
    const linked = await updateSubmission(submission.id, { linkedStudentId: existing.id }, coordinator);
    assert.equal(linked!.linkedStudent?.id, existing.id);
    assert.equal(linked!.status, "NEW", "linking is not a conversion");
    await expectApiError(updateSubmission(submission.id, { linkedStudentId: "no-such-student" }, coordinator), 400);
  });
});
