/**
 * Fixes from the 9 Oct 2026 audit: attendance permissions, paid payouts,
 * IST day/month ranges, and the phone app following the website's rules.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma, owner, coordinator, accounts, makeSubject, makeTeacher, makeStudent, makePackage, enrol, uid } from "./helpers";
import { recordManualAttendance, editManualAttendance, deleteManualAttendance } from "../src/lib/services/manual-attendance";
import { getTrainerMyStudents } from "../src/lib/services/trainer-portal";
import { ApiError } from "../src/lib/api-errors";
import { istPeriods } from "../src/lib/ist-periods";
import { POST as phoneLogin } from "../src/app/api/mobile/auth/login/route";
import { POST as trainerMark } from "../src/app/api/mobile/trainer/sessions/[id]/attendance/route";
import { POST as trainerRecord } from "../src/app/api/mobile/trainer/attendance/route";
import { POST as staffMark } from "../src/app/api/mobile/admin/attendance/route";
import { POST as phoneBilling } from "../src/app/api/mobile/admin/billing/route";
import { GET as trainerStudents } from "../src/app/api/mobile/trainer/students/route";
import { CurrentUser } from "../src/lib/types";

type Handler = (req: Request, ctx: unknown) => Promise<Response>;
const PASSWORD = "audit-test-password-123";
const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

async function status(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (err) {
    if (err instanceof ApiError) return err.status;
    throw err;
  }
}

/** A trainer with a login, an active student, subject, package and enrolment. */
async function trainerSetup(name: string) {
  const subject = await makeSubject("Chemistry");
  const teacher = await makeTeacher(name);
  const student = await makeStudent({ grade: "10th Grade" });
  await enrol(student.id, subject.id, teacher.id);
  const pkg = await makePackage(student.id, [{ subjectId: subject.id, credits: 10 }]);
  const email = `${uid("trainer")}@example.test`;
  const login = await prisma.user.create({
    data: { name: teacher.name, email, role: "TEACHER", teacherId: teacher.id, passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
  const user: CurrentUser = { id: login.id, name: login.name, email, role: "TEACHER", teacherId: teacher.id };
  return { subject, teacher, student, pkg, email, user };
}

async function phoneToken(email: string): Promise<string> {
  const res = await (phoneLogin as Handler)(
    new Request("http://localhost/api/mobile/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) }),
    {}
  );
  const json = (await res.json()) as { token?: string };
  assert.ok(json.token, "phone sign-in failed");
  return json.token;
}

function call(handler: Handler, path: string, token: string, body?: unknown, ctx: unknown = {}) {
  return handler(
    new Request(`http://localhost${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    ctx
  );
}

describe("attendance permissions are not granted by display name", () => {
  test("a login whose name matches the marker cannot edit or delete; the class's trainer can", async () => {
    const t = await trainerSetup("Name Clash Trainer");
    const att = await recordManualAttendance(
      { studentId: t.student.id, subjectId: t.subject.id, classDate: istToday(), durationMinutes: 60, topicCovered: "Atoms" },
      t.user
    );
    const sameNameAccounts: CurrentUser = { ...accounts, name: t.user.name };
    const other = await makeTeacher("Other Trainer");
    const sameNameOtherTrainer: CurrentUser = { id: uid("u"), name: t.user.name, email: "x@example.test", role: "TEACHER", teacherId: other.id };

    assert.equal(await status(editManualAttendance({ attendanceId: att.attendanceId, topicCovered: "Changed" }, sameNameAccounts)), 403);
    assert.equal(await status(editManualAttendance({ attendanceId: att.attendanceId, topicCovered: "Changed" }, sameNameOtherTrainer)), 403);
    assert.equal(await status(deleteManualAttendance(att.attendanceId, sameNameOtherTrainer)), 403);
    assert.equal(await status(editManualAttendance({ attendanceId: att.attendanceId, topicCovered: "Ionic bonds" }, t.user)), 200);
  });
});

describe("a class whose trainer payout is paid keeps its hours", () => {
  test("trainer and coordinator cannot delete it or change its length; notes can change; the owner can still delete", async () => {
    const t = await trainerSetup("Paid Payout Trainer");
    const att = await recordManualAttendance(
      { studentId: t.student.id, subjectId: t.subject.id, classDate: istToday(), durationMinutes: 60, topicCovered: "Acids" },
      t.user
    );
    const record = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: att.attendanceId } });
    await prisma.payoutItem.update({ where: { sessionId: record.sessionId }, data: { status: "PAID" } });

    assert.equal(await status(deleteManualAttendance(att.attendanceId, t.user)), 409);
    assert.equal(await status(deleteManualAttendance(att.attendanceId, coordinator)), 409);
    assert.equal(await status(editManualAttendance({ attendanceId: att.attendanceId, durationMinutes: 120 }, t.user)), 409);
    assert.equal(await status(editManualAttendance({ attendanceId: att.attendanceId, topicCovered: "Acids and bases" }, t.user)), 200);
    assert.ok(await prisma.attendanceRecord.findUnique({ where: { id: att.attendanceId } }), "record was deleted");
    const payout = await prisma.payoutItem.findUniqueOrThrow({ where: { sessionId: record.sessionId } });
    assert.equal(payout.status, "PAID");
    assert.equal(payout.durationMinutes, 60);

    assert.equal(await status(deleteManualAttendance(att.attendanceId, owner)), 200);
  });

  test("before the payout is paid, the trainer can still delete their class (credits restored)", async () => {
    const t = await trainerSetup("Unpaid Payout Trainer");
    const att = await recordManualAttendance(
      { studentId: t.student.id, subjectId: t.subject.id, classDate: istToday(), durationMinutes: 60, topicCovered: "Salts" },
      t.user
    );
    assert.equal(await status(deleteManualAttendance(att.attendanceId, t.user)), 200);
  });
});

describe("IST days and months", () => {
  test("00:30 IST on 10 Oct counts as 10 Oct, not 9 Oct", () => {
    const p = istPeriods(new Date("2026-10-09T19:00:00Z"));
    assert.equal(p.today.gte.toISOString(), "2026-10-09T18:30:00.000Z");
    assert.equal(p.today.lt.toISOString(), "2026-10-10T18:30:00.000Z");
    assert.equal(p.month.gte.toISOString(), "2026-09-30T18:30:00.000Z");
    assert.equal(p.month.lt.toISOString(), "2026-10-31T18:30:00.000Z");
  });
  test("New Year in IST starts a new month and year", () => {
    const p = istPeriods(new Date("2026-12-31T20:00:00Z"));
    assert.equal(p.today.gte.toISOString(), "2026-12-31T18:30:00.000Z");
    assert.equal(p.month.gte.toISOString(), "2026-12-31T18:30:00.000Z");
    assert.equal(p.month.lt.toISOString(), "2027-01-31T18:30:00.000Z");
  });
});

describe("phone app follows the website's rules", () => {
  async function scheduledClass(t: Awaited<ReturnType<typeof trainerSetup>>, minutes = 60) {
    const start = new Date(Date.now() - 3 * 3600 * 1000);
    return prisma.session.create({
      data: {
        packageId: t.pkg.id,
        studentId: t.student.id,
        teacherId: t.teacher.id,
        subjectId: t.subject.id,
        scheduledStartTimeUtc: start,
        scheduledEndTimeUtc: new Date(start.getTime() + minutes * 60 * 1000),
        durationMinutes: minutes,
      },
    });
  }

  test("a trainer marks their class from the phone: one credit through the ledger, a pay record, no double charge", async () => {
    const t = await trainerSetup("Phone Trainer");
    const session = await scheduledClass(t);
    const token = await phoneToken(t.email);
    const body = { sessionOutcome: "COMPLETED", studentAttendance: "PRESENT", actualDurationMinutes: 60, topicCovered: "Periodic table" };
    const path = `/api/mobile/trainer/sessions/${session.id}/attendance`;
    const ctx = { params: Promise.resolve({ id: session.id }) };

    const first = await call(trainerMark as Handler, path, token, body, ctx);
    assert.equal(first.status, 200, JSON.stringify(await first.clone().json()));
    const again = await call(trainerMark as Handler, path, token, body, { params: Promise.resolve({ id: session.id }) });
    assert.equal(again.status, 200);
    assert.equal((await again.json()).alreadyProcessed, true);

    const ledger = await prisma.creditLedger.findMany({ where: { sessionId: session.id, eventType: "SESSION_CONSUMED" } });
    assert.equal(ledger.length, 1);
    assert.equal(await prisma.payoutItem.count({ where: { sessionId: session.id } }), 1);

    // The phone's student list shows the same remaining classes as the website.
    const res = await call(trainerStudents as Handler, "/api/mobile/trainer/students", token);
    const phone = (await res.json()).students.find((s: { id: string }) => s.id === t.student.id);
    const web = (await getTrainerMyStudents(t.teacher.id)).find((s) => s.studentId === t.student.id)!;
    assert.equal(phone.assignedSubjects[0].remainingCredits, web.assignedSubjects[0].remainingCredits);
    assert.equal(phone.assignedSubjects[0].remainingCredits, 9);
  });

  test("a trainer cannot mark another trainer's class from the phone", async () => {
    const t = await trainerSetup("Owner Of Class");
    const other = await trainerSetup("Not The Trainer");
    const session = await scheduledClass(t);
    const res = await call(
      trainerMark as Handler,
      `/api/mobile/trainer/sessions/${session.id}/attendance`,
      await phoneToken(other.email),
      { sessionOutcome: "COMPLETED", studentAttendance: "PRESENT", actualDurationMinutes: 60 },
      { params: Promise.resolve({ id: session.id }) }
    );
    assert.equal(res.status, 403);
    assert.equal(await prisma.attendanceRecord.count({ where: { sessionId: session.id } }), 0);
  });

  test("staff marking from the phone goes through the ledger and keeps the class's scheduled length", async () => {
    const t = await trainerSetup("Staff Marked Trainer");
    const session = await scheduledClass(t, 90);
    const email = `${uid("coord")}@example.test`;
    await prisma.user.create({ data: { name: "Phone Coordinator", email, role: "COORDINATOR", passwordHash: await bcrypt.hash(PASSWORD, 4) } });
    const res = await call(staffMark as Handler, "/api/mobile/admin/attendance", await phoneToken(email), {
      sessionId: session.id,
      sessionOutcome: "COMPLETED",
      studentAttendance: "PRESENT",
      topicCovered: "Regular class covered",
    });
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const record = await prisma.attendanceRecord.findUniqueOrThrow({ where: { sessionId: session.id } });
    assert.equal(record.actualDurationMinutes, 90);
    assert.equal(await prisma.creditLedger.count({ where: { sessionId: session.id, eventType: "SESSION_CONSUMED" } }), 1);
  });

  test("a trainer records a class from a student's page on the phone, with the website's checks", async () => {
    const t = await trainerSetup("Phone Manual Trainer");
    const token = await phoneToken(t.email);
    const body = { studentId: t.student.id, subjectId: t.subject.id, classDate: istToday(), durationMinutes: 120, topicCovered: "Redox" };

    const first = await call(trainerRecord as Handler, "/api/mobile/trainer/attendance", token, body);
    assert.equal(first.status, 200, JSON.stringify(await first.clone().json()));
    const firstJson = await first.json();
    assert.equal(firstJson.creditsDeducted, 2);

    // A double tap within seconds is not saved twice (website rule).
    const doubleTap = await call(trainerRecord as Handler, "/api/mobile/trainer/attendance", token, body);
    assert.equal(doubleTap.status, 200);
    assert.equal((await doubleTap.json()).alreadyProcessed, true);

    // Later the same day, same subject: the website's duplicate question, answered by confirming.
    await prisma.attendanceRecord.update({ where: { id: firstJson.attendanceId }, data: { markedAt: new Date(Date.now() - 60_000) } });
    const dup = await call(trainerRecord as Handler, "/api/mobile/trainer/attendance", token, body);
    assert.equal(dup.status, 409);
    assert.equal((await dup.json()).details?.code, "DUPLICATE_ATTENDANCE");
    const confirmed = await call(trainerRecord as Handler, "/api/mobile/trainer/attendance", token, { ...body, confirmDuplicate: true });
    assert.equal(confirmed.status, 200);

    // Another trainer's student is refused.
    const other = await trainerSetup("Other Phone Trainer");
    const refused = await call(trainerRecord as Handler, "/api/mobile/trainer/attendance", await phoneToken(other.email), body);
    assert.equal(refused.status, 403);
  });

  test("the phone can no longer set an invoice to Paid without a payment", async () => {
    const student = await makeStudent();
    const invoice = await prisma.invoice.create({
      data: { invoiceNumber: uid("INV-T"), studentId: student.id, subtotal: 5000, totalAmount: 5000, balanceDue: 5000, status: "UNPAID", dueDate: new Date() },
    });
    const email = `${uid("owner")}@example.test`;
    await prisma.user.create({ data: { name: "Phone Owner", email, role: "OWNER", passwordHash: await bcrypt.hash(PASSWORD, 4) } });
    const res = await call(phoneBilling as Handler, "/api/mobile/admin/billing", await phoneToken(email), { invoiceId: invoice.id, action: "MARK_PAID" });
    assert.equal(res.status, 400);
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(after.status, "UNPAID");
    assert.equal(after.balanceDue, 5000);
    assert.equal(after.paidAmount, 0);
  });
});
