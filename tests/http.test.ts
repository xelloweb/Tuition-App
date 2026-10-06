/**
 * End-to-end API checks against a running server (set TEST_BASE_URL).
 * The server must use a disposable database: these tests create fictional records.
 */
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.TEST_BASE_URL ?? "";
const run = `${Date.now().toString(36)}`;

async function call(persona: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: `xello_user_persona=${persona}`, ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

describe("HTTP API", { skip: !BASE }, () => {
  let subjectId = "";
  let trainerId = "";
  let studentId = "";

  before(async () => {
    const subjects = await call("admin", "GET", "/api/subjects");
    subjectId = (subjects.json!.subjects as { id: string }[])[0].id;
  });

  test("add trainer: owner succeeds, the trainer appears in the list, a retry does not duplicate", async () => {
    const body = {
      name: `HTTP Trainer ${run}`,
      email: `http.trainer.${run}@example.test`,
      phone: "+91 98470 11111",
      subjects: ["Mathematics"],
      grades: ["Plus Two (+2 / 12th)"],
      country: "India",
      timeZone: "Asia/Kolkata",
      defaultRate: 650,
      gradeRates: {},
    };
    const key = `http-trainer-${run}`;
    const created = await call("admin", "POST", "/api/teachers", body, { "Idempotency-Key": key });
    assert.equal(created.status, 201, created.text);
    trainerId = (created.json!.teacher as { id: string }).id;
    const retry = await call("admin", "POST", "/api/teachers", body, { "Idempotency-Key": key });
    assert.equal(retry.status, 200);
    assert.equal((retry.json!.teacher as { id: string }).id, trainerId);
    const list = await call("coordinator", "GET", "/api/teachers");
    assert.ok((list.json!.teachers as { id: string }[]).some((t) => t.id === trainerId));
  });

  test("add trainer: field errors, duplicate email and malformed JSON return safe messages", async () => {
    const bad = await call("admin", "POST", "/api/teachers", { name: "", email: "nope", phone: "123", subjects: [], grades: [] });
    assert.equal(bad.status, 400);
    assert.ok((bad.json!.fieldErrors as Record<string, string>).email);
    const dup = await call("admin", "POST", "/api/teachers", {
      name: "Dup", email: `HTTP.TRAINER.${run}@EXAMPLE.TEST`, phone: "+91 98470 22222", subjects: ["Maths"], grades: ["Primary"],
    });
    assert.equal(dup.status, 409);
    const malformed = await call("admin", "POST", "/api/teachers", "{bad json");
    assert.equal(malformed.status, 400);
    assert.equal(malformed.json!.code, "INVALID_JSON");
    assert.ok(!/position|Unexpected token|prisma/i.test(malformed.text), "no raw parser or database text");
  });

  test("add student: coordinator creates one with an unassigned subject and no package; it is listed and its profile opens", async () => {
    const created = await call("coordinator", "POST", "/api/students", {
      name: `HTTP Student ${run}`,
      grade: "10th Grade",
      guardianName: "HTTP Parent",
      whatsappNumber: "+971 50 999 0000",
      country: "UAE",
      timeZone: "Asia/Dubai",
      enrolments: [{ subjectId, teacherId: null }],
      initialPackage: null,
    }, { "Idempotency-Key": `http-student-${run}` });
    assert.equal(created.status, 201, created.text);
    studentId = (created.json!.student as { id: string }).id;
    const list = await call("coordinator", "GET", "/api/students");
    assert.ok((list.json!.students as { id: string }[]).some((s) => s.id === studentId));
    const page = await fetch(`${BASE}/students/${studentId}`, { headers: { Cookie: "xello_user_persona=coordinator" } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), new RegExp(`HTTP Student ${run}`));
  });

  test("assign trainer and save a weekly timetable through the API", async () => {
    const assign = await call("coordinator", "POST", `/api/students/${studentId}/enrolments`, { subjectId, teacherId: trainerId });
    assert.equal(assign.status, 200, assign.text);
    const tt = await call("coordinator", "GET", `/api/students/${studentId}/timetable`);
    const enrolmentId = ((tt.json!.timetable as { enrolments: { id: string }[] }).enrolments)[0].id;
    const preview = await call("coordinator", "POST", `/api/students/${studentId}/timetable`, {
      timeZone: "Asia/Dubai",
      previewOnly: true,
      slots: [{ enrolmentId, weekday: 0, start: "20:00", end: "21:00" }, { enrolmentId, weekday: 1, start: "19:00", end: "20:00" }],
    });
    assert.equal(preview.status, 200, preview.text);
    const saved = await call("coordinator", "POST", `/api/students/${studentId}/timetable`, {
      timeZone: "Asia/Dubai",
      slots: [{ enrolmentId, weekday: 0, start: "20:00", end: "21:00" }, { enrolmentId, weekday: 1, start: "19:00", end: "20:00" }],
    });
    assert.equal(saved.status, 200, saved.text);
    const view = saved.json!.timetable as { slots: unknown[]; issues: { reason: string }[] };
    assert.equal(view.slots.length, 2);
    assert.ok(view.issues.some((i) => i.reason === "NO_PACKAGE"), "no package -> renewal flag, nothing booked");
  });

  test("unauthorized roles are rejected even when calling the API directly", async () => {
    const trainerBody = { name: "X", email: `x.${run}@example.test`, phone: "+91 98470 33333", subjects: ["Maths"], grades: ["Primary"] };
    assert.equal((await call("teacher_rahul", "POST", "/api/teachers", trainerBody)).status, 403);
    assert.equal((await call("accounts", "POST", "/api/teachers", trainerBody)).status, 403);
    assert.equal((await call("coordinator", "POST", "/api/teachers", { ...trainerBody, defaultRate: 900 })).status, 403, "coordinator cannot set pay");
    const studentBody = { name: "X", grade: "10th Grade", guardianName: "P", whatsappNumber: "+91 98470 44444" };
    assert.equal((await call("teacher_priya", "POST", "/api/students", studentBody)).status, 403);
    assert.equal((await call("accounts", "POST", "/api/students", studentBody)).status, 403);
    assert.equal((await call("teacher_rahul", "POST", `/api/students/${studentId}/timetable`, { slots: [] })).status, 403);
    assert.equal((await call("accounts", "POST", `/api/students/${studentId}/timetable/generate`)).status, 403);
    assert.equal((await call("teacher_rahul", "POST", "/api/sessions", {})).status, 403);
    assert.equal((await call("coordinator", "POST", "/api/payments", { studentId, amount: 100, paymentMethod: "UPI" })).status, 403);
    assert.equal((await call("teacher_rahul", "POST", "/api/follow-ups", { studentId })).status, 403);
    assert.equal((await call("teacher_rahul", "GET", "/api/reports/export?type=attendance")).status, 403);
    assert.equal((await call("teacher_rahul", "GET", `/api/students/${studentId}/timetable`)).status, 403, "not assigned to this student");
  });

  test("teachers only see their own data and no other trainer's pay", async () => {
    const teachers = await call("teacher_priya", "GET", "/api/teachers");
    const list = teachers.json!.teachers as { id: string; defaultRate: number | null }[];
    assert.ok(list.every((t) => t.id === "tch-priya"), "only own profile");
    const coordView = await call("coordinator", "GET", "/api/teachers");
    assert.ok((coordView.json!.teachers as { defaultRate: number | null }[]).every((t) => t.defaultRate === null), "coordinator sees no rates");
    const students = await call("teacher_priya", "GET", "/api/students");
    assert.ok(!(students.json!.students as { id: string }[]).some((s) => s.id === studentId), "unassigned student hidden");
    const billing = await fetch(`${BASE}/billing`, { headers: { Cookie: "xello_user_persona=teacher_priya" } });
    assert.match(await billing.text(), /Access restricted/);
  });
});
