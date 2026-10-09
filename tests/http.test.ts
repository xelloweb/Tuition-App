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
  unlinked: "unlinked.trainer@example.test",
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

  test("no public way to take over a login: the fixed owner password fails and the open reset endpoint is gone", async () => {
    assert.equal(await signIn(EMAILS.admin, "xelloadmin1234"), null, "the password committed on 8 Oct 2026 does not open the owner account");
    assert.ok(await signIn(EMAILS.admin, PASSWORD), "the owner's real password still works, so the attempt changed nothing");
    const reset = await call(null, "POST", "/api/auth/forgot-password", { email: EMAILS.admin, newPassword: "attacker-password-123" });
    // The address now reaches NextAuth's catch-all, which rejects unknown actions without touching any account.
    assert.ok(reset.status >= 400, `no unauthenticated password reset (got ${reset.status})`);
    assert.doesNotMatch(JSON.stringify(reset.json ?? {}), /success|resetToken/);
    assert.ok(await signIn(EMAILS.admin, PASSWORD));
    const page = await fetch(`${BASE}/forgot-password`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Ask the owner for a new password link/);
  });

  test("change password: wrong current password is refused; the new password works and every old session ends", async () => {
    const before = await sessionFor("accounts");
    const wrong = await call("accounts", "POST", "/api/auth/change-password", { currentPassword: "nope", newPassword: "a-much-better-passphrase" });
    assert.equal(wrong.status, 400);
    const ok = await call("accounts", "POST", "/api/auth/change-password", { currentPassword: PASSWORD, newPassword: "a-much-better-passphrase" });
    assert.equal(ok.status, 200, ok.text);
    const stale = await fetch(`${BASE}/api/students`, { headers: { Cookie: before } });
    assert.equal(stale.status, 401, "sessions signed before the change no longer work");
    sessions.delete("accounts");
    const fresh = await signIn(EMAILS.accounts, "a-much-better-passphrase");
    assert.ok(fresh);
    assert.equal(await signIn(EMAILS.accounts, PASSWORD), null, "old password no longer works");
    // Put the fixture password back for the tests that follow.
    const back = await fetch(`${BASE}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: fresh! },
      body: JSON.stringify({ currentPassword: "a-much-better-passphrase", newPassword: PASSWORD }),
    });
    assert.equal(back.status, 200);
  });

  test("a login still on the published demo password cannot sign in", async () => {
    assert.equal(await signIn("legacy.demo@example.test", "demo123"), null);
  });

  test("users & logins: owner-only; links work once; reset and switch-off end sessions; no self lock-out", async () => {
    const email = `new.staff.${run}@example.test`;
    assert.equal((await call("coordinator", "POST", "/api/users", { name: "Someone", email, role: "ACCOUNTS" })).status, 403);
    assert.equal((await call("accounts", "PATCH", "/api/users/usr-admin", { active: false })).status, 403);

    const created = await call("admin", "POST", "/api/users", { name: `New Staff ${run}`, email, role: "ACCOUNTS" });
    assert.equal(created.status, 201, created.text);
    const staffId = (created.json!.user as { id: string }).id;
    const token = new URL(created.json!.setupLink as string).searchParams.get("token")!;
    assert.equal((await call("admin", "POST", "/api/users", { name: "Duplicate", email, role: "ACCOUNTS" })).status, 409);

    assert.equal((await call(null, "POST", "/api/auth/setup-password", { token, password: "staff-passphrase-123" })).status, 200);
    assert.equal((await call(null, "POST", "/api/auth/setup-password", { token, password: "staff-passphrase-456" })).status, 400, "a link works once");
    const firstCookie = await signIn(email, "staff-passphrase-123");
    assert.ok(firstCookie);

    const reset = await call("admin", "POST", `/api/users/${staffId}/reset-link`);
    assert.equal(reset.status, 200, reset.text);
    assert.equal((await fetch(`${BASE}/api/students`, { headers: { Cookie: firstCookie! } })).status, 401, "reset ends sessions");
    assert.equal(await signIn(email, "staff-passphrase-123"), null, "reset revokes the old password");

    const token2 = new URL(reset.json!.setupLink as string).searchParams.get("token")!;
    assert.equal((await call(null, "POST", "/api/auth/setup-password", { token: token2, password: "staff-passphrase-789" })).status, 200);
    const secondCookie = await signIn(email, "staff-passphrase-789");
    assert.ok(secondCookie);
    assert.equal((await call("admin", "PATCH", `/api/users/${staffId}`, { active: false })).status, 200);
    assert.equal((await fetch(`${BASE}/api/students`, { headers: { Cookie: secondCookie! } })).status, 401, "switching off ends sessions");
    assert.equal(await signIn(email, "staff-passphrase-789"), null, "switched-off logins cannot sign in");

    assert.equal((await call("admin", "PATCH", "/api/users/usr-admin", { active: false })).status, 409, "no self switch-off");
    assert.equal((await call("admin", "POST", "/api/users/usr-admin/reset-link")).status, 409, "own password changes go through My Account");
    assert.equal((await page("admin", "/users")).status, 200);
    assert.match(await (await page("coordinator", "/users")).text(), /managed by the owner/);
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
    const otherZone = await call("coordinator", "POST", `/api/students/${studentId}/timetable`, {
      timeZone: "Asia/Dubai",
      slots: [{ enrolmentId, weekday: 0, start: "20:00", end: "21:00" }],
    });
    assert.equal(otherZone.status, 400, "India time only: other zones are refused");
    assert.match(String((otherZone.json!.fieldErrors as Record<string, string>).timeZone), /IST/);
    const preview = await call("coordinator", "POST", `/api/students/${studentId}/timetable`, {
      timeZone: "Asia/Kolkata",
      previewOnly: true,
      slots: [{ enrolmentId, weekday: 0, start: "20:00", end: "21:00" }, { enrolmentId, weekday: 1, start: "19:00", end: "20:00" }],
    });
    assert.equal(preview.status, 200, preview.text);
    const saved = await call("coordinator", "POST", `/api/students/${studentId}/timetable`, {
      timeZone: "Asia/Kolkata",
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

  test("a trainer login without a linked trainer profile sees no one's data", async () => {
    for (const path of ["/", "/attendance", "/timetable", "/payouts", "/progress"]) {
      const res = await page("unlinked", path);
      assert.equal(res.status, 200, path);
      const html = await res.text();
      assert.match(html, /not linked to a trainer profile/, path);
      assert.doesNotMatch(html, /Rahul Varma|Priya Menon/, `${path} shows no other trainer`);
    }
    const students = await call("unlinked", "GET", "/api/students");
    assert.equal(students.status, 200);
    assert.deepEqual(students.json!.students, []);
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

describe("parent admission form (public) over HTTP", { skip: !BASE }, () => {
  let subjectId = "";
  let n = 0;
  const key = () => `http-${run}-${++n}-abcdefghijklmnop`;
  const fromAddress = (last: number) => ({ "X-Forwarded-For": `198.51.100.${last}` });
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const form = (extra: Record<string, unknown> = {}) => ({
    studentName: `HTTP Applicant ${run}`,
    grade: "9th Grade",
    board: "CBSE",
    subjectIds: [subjectId],
    guardianName: "Fictional Parent",
    relationship: "Mother",
    whatsappNumber: "050 765 4321",
    country: "UAE",
    preferences: [{ subjectId, weekday: 6, start: "10:00", end: "11:00" }],
    consent: true,
    ...extra,
  });
  async function freshToken() {
    const res = await fetch(`${BASE}/api/public/admission-enquiries/token`);
    return ((await res.json()) as { formToken: string }).formToken;
  }
  async function send(body: Record<string, unknown>, headers: Record<string, string> = {}) {
    const res = await fetch(`${BASE}/api/public/admission-enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE, ...headers },
      body: JSON.stringify(body),
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
  let token = "";

  before(async () => {
    const subjects = await call("admin", "GET", "/api/subjects");
    subjectId = (subjects.json!.subjects as { id: string }[])[0].id;
    token = await freshToken();
    await sleep(3200); // a real form is open for more than a few seconds
  });

  test("the form opens without a login and shows only the form", async () => {
    const res = await fetch(`${BASE}/admission/apply`, { redirect: "manual" });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Student admission form/);
    assert.match(html, /All timings must be entered in Indian Standard Time \(IST\)\. These are preferences only\./);
    assert.doesNotMatch(html, /Sign out|Students Directory|Invoices &amp; payments/);
  });

  test("anonymous visitors cannot read or change submissions", async () => {
    for (const [method, path] of [
      ["GET", "/api/parent-submissions"],
      ["GET", "/api/parent-submissions/any-id"],
      ["PATCH", "/api/parent-submissions/any-id"],
      ["POST", "/api/parent-submissions/any-id/notes"],
    ]) {
      const res = await call(null, method, path, method === "GET" ? undefined : {});
      assert.equal(res.status, 401, `${method} ${path}`);
    }
    const inbox = await fetch(`${BASE}/admissions`, { redirect: "manual" });
    assert.ok([302, 303, 307].includes(inbox.status), "the staff inbox needs a login");
  });

  test("a submission answers with a reference only; a retry gets the same reference; only staff can see it", async () => {
    const body = { ...form(), formToken: token, submissionKey: key() };
    const first = await send(body, fromAddress(1));
    assert.equal(first.status, 201, first.text);
    assert.deepEqual(Object.keys(first.json!).sort(), ["reference", "success"]);
    const retry = await send(body, fromAddress(1));
    assert.equal(retry.json!.reference, first.json!.reference);

    const list = await call("coordinator", "GET", `/api/parent-submissions?status=ALL&q=${first.json!.reference}`);
    assert.equal(list.status, 200);
    const items = list.json!.items as { reference: string; whatsappNumber: string }[];
    assert.equal(items.length, 1);
    assert.equal(items[0].whatsappNumber, "+971 507654321", "local UAE number stored with its country code");
    assert.equal((await call("accounts", "GET", "/api/parent-submissions")).status, 403);
    assert.equal((await call("teacher_priya", "GET", "/api/parent-submissions")).status, 403);
  });

  test("a brother or sister with the same parent number is accepted, and nothing says the number is known", async () => {
    const a = await send({ ...form({ studentName: `Sibling A ${run}`, whatsappNumber: "+971 50 111 2222" }), formToken: token, submissionKey: key() }, fromAddress(4));
    const b = await send({ ...form({ studentName: `Sibling B ${run}`, whatsappNumber: "+971 50 111 2222" }), formToken: token, submissionKey: key() }, fromAddress(4));
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.deepEqual(Object.keys(b.json!).sort(), ["reference", "success"]);
    assert.notEqual(a.json!.reference, b.json!.reference);
  });

  test("forged, automated, oversized or malformed requests are refused with safe messages", async () => {
    assert.equal((await send({ ...form(), formToken: token, submissionKey: key() }, { Origin: "https://evil.example.test", ...fromAddress(2) })).status, 403);
    assert.equal((await send({ ...form(), formToken: token, submissionKey: key(), website: "http://spam.example" }, fromAddress(2))).status, 400);
    assert.equal((await send({ ...form(), formToken: token, submissionKey: key(), notes: "x".repeat(40_000) }, fromAddress(2))).status, 413);
    const tooFast = await send({ ...form(), formToken: await freshToken(), submissionKey: key() }, fromAddress(2));
    assert.equal(tooFast.status, 400);
    assert.match(String(tooFast.json!.error), /take a moment/);
    const stale = await send({ ...form(), formToken: "made.up.token", submissionKey: key() }, fromAddress(2));
    assert.equal(stale.status, 409);
    assert.equal((stale.json!.details as { reason: string }).reason, "FORM_EXPIRED");
    const invalid = await send({ ...form({ whatsappNumber: "123", consent: false }), formToken: token, submissionKey: key() }, fromAddress(2));
    assert.equal(invalid.status, 400);
    assert.ok((invalid.json!.fieldErrors as Record<string, string>).whatsappNumber);
    assert.ok((invalid.json!.fieldErrors as Record<string, string>).consent);
    assert.doesNotMatch(invalid.text, /prisma|stack|at \w+ \(/i);
    const notJson = await fetch(`${BASE}/api/public/admission-enquiries`, { method: "POST", headers: { "Content-Type": "text/plain", Origin: BASE }, body: "hello" });
    assert.equal(notJson.status, 400);
  });

  test("the privacy notice is public; only the owner can delete a submission", async () => {
    const res = await fetch(`${BASE}/privacy`, { redirect: "manual" });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<h1[^>]*>Privacy notice<\/h1>/);
    assert.doesNotMatch(html, /Sign out|Students Directory/);
    assert.equal((await call(null, "DELETE", "/api/parent-submissions/any-id")).status, 401);
    assert.equal((await call("coordinator", "DELETE", "/api/parent-submissions/any-id")).status, 403);
    assert.equal((await call("admin", "DELETE", "/api/parent-submissions/no-such-id")).status, 404);
  });

  test("too many forms from one connection are slowed down", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await send({ ...form({ studentName: `Rate ${i} ${run}` }), formToken: token, submissionKey: key() }, fromAddress(3))).status);
    assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
  });
});

// Owner, coordinator and accounts may use it (owner's decision, 9 Oct 2026); trainers may not.
describe("assign package using existing payment (owner, coordinator, accounts) over HTTP", { skip: !BASE }, () => {
  test("owner, coordinator and accounts can see and use a student's existing payments; trainers cannot", async () => {
    const students = await call("admin", "GET", "/api/students");
    const id = (students.json!.students as { id: string }[])[0].id;
    assert.equal((await call(null, "GET", `/api/students/${id}/existing-payment`)).status, 401);
    assert.equal((await call("coordinator", "GET", `/api/students/${id}/existing-payment`)).status, 200);
    assert.equal((await call("accounts", "GET", `/api/students/${id}/existing-payment`)).status, 200);
    // Accounts reaches the form's own checks (an empty request is refused as invalid, not forbidden).
    assert.equal((await call("accounts", "POST", `/api/students/${id}/existing-payment`, {})).status, 400);
    assert.equal((await call("teacher_rahul", "GET", `/api/students/${id}/existing-payment`)).status, 403);
    const own = await call("admin", "GET", `/api/students/${id}/existing-payment`);
    assert.equal(own.status, 200);
    assert.ok(own.json!.options);
    const invalid = await call("admin", "POST", `/api/students/${id}/existing-payment`, { source: { type: "PAYMENTS" } });
    assert.equal(invalid.status, 400);
    assert.doesNotMatch(JSON.stringify(invalid.json), /prisma|stack/i);
  });
});
