/**
 * End-to-end API checks against a running server (set TEST_BASE_URL).
 * The server must use a disposable database: these tests create fictional records.
 */
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.TEST_BASE_URL ?? "";
const run = `${Date.now().toString(36)}`;

// Fixture accounts from scripts/test-fixtures.ts (test database only).
const PASSWORD = "fixture-password-123";
const EMAILS: Record<string, string> = {
  admin: "admin@xellotuition.com",
  coordinator: "coordinator@xellotuition.com",
  accounts: "accounts@xellotuition.com",
  teacher_rahul: "teacher.rahul@xellotuition.com",
  teacher_priya: "teacher.priya@xellotuition.com",
};
const sessions = new Map<string, string>();

function absorbCookies(jar: Map<string, string>, res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

/** Signs in through NextAuth's credentials flow and returns the session cookie header. */
async function signIn(email: string, password: string): Promise<string | null> {
  const jar = new Map<string, string>();
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  absorbCookies(jar, csrf);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader(jar) },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
  });
  absorbCookies(jar, res);
  return [...jar.keys()].some((k) => k.includes("session-token")) ? cookieHeader(jar) : null;
}

async function sessionFor(persona: string): Promise<string> {
  if (!sessions.has(persona)) {
    const cookie = await signIn(EMAILS[persona], PASSWORD);
    if (!cookie) throw new Error(`Could not sign in as ${persona}`);
    sessions.set(persona, cookie);
  }
  return sessions.get(persona)!;
}

async function call(persona: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      ...(persona ? { Cookie: await sessionFor(persona) } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text, location: res.headers.get("location") };
}

async function page(persona: string, path: string) {
  return fetch(`${BASE}${path}`, { headers: { Cookie: await sessionFor(persona) }, redirect: "manual" });
}

describe("HTTP API", { skip: !BASE }, () => {
  let subjectId = "";
  let trainerId = "";
  let studentId = "";

  before(async () => {
    const subjects = await call("admin", "GET", "/api/subjects");
    subjectId = (subjects.json!.subjects as { id: string }[])[0].id;
  });

  test("signed-out requests: API answers 401 JSON, pages redirect to login, wrong passwords are refused", async () => {
    const api = await call(null, "GET", "/api/students");
    assert.equal(api.status, 401);
    assert.equal(api.json?.code, "UNAUTHENTICATED");
    const pageRes = await fetch(`${BASE}/students`, { redirect: "manual" });
    assert.ok([302, 303, 307].includes(pageRes.status));
    assert.match(pageRes.headers.get("location") ?? "", /\/login/);
    assert.equal(await signIn(EMAILS.admin, "wrong-password"), null);
    assert.equal(await signIn(EMAILS.admin, "demo123"), null, "public demo password does not work");
  });

  test("change password: wrong current password is refused; the new password works", async () => {
    const wrong = await call("accounts", "POST", "/api/auth/change-password", { currentPassword: "nope", newPassword: "a-much-better-passphrase" });
    assert.equal(wrong.status, 400);
    const ok = await call("accounts", "POST", "/api/auth/change-password", { currentPassword: PASSWORD, newPassword: "a-much-better-passphrase" });
    assert.equal(ok.status, 200, ok.text);
    assert.ok(await signIn(EMAILS.accounts, "a-much-better-passphrase"));
    assert.equal(await signIn(EMAILS.accounts, PASSWORD), null, "old password no longer works");
  });

  test("my account: users change their own display name; signed-out and blank names are refused", async () => {
    assert.equal((await call(null, "POST", "/api/auth/profile", { name: "Someone" })).status, 401);
    assert.equal((await call("admin", "POST", "/api/auth/profile", { name: "  " })).status, 400);
    const ok = await call("admin", "POST", "/api/auth/profile", { name: "Shamrood" });
    assert.equal(ok.status, 200, ok.text);
    const account = await page("admin", "/account");
    assert.equal(account.status, 200);
    assert.match(await account.text(), /Shamrood/);
    const oldLink = await page("admin", "/account/password");
    assert.ok([303, 307, 308].includes(oldLink.status));
    assert.match(oldLink.headers.get("location") ?? "", /\/account$/);
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
    const profile = await page("coordinator", `/students/${studentId}`);
    assert.equal(profile.status, 200);
    assert.match(await profile.text(), new RegExp(`HTTP Student ${run}`));
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
    const billing = await page("teacher_priya", "/billing");
    assert.match(await billing.text(), /Access restricted/);
  });
});
