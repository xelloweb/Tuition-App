/**
 * The phone app's API (/api/mobile/*) must answer only signed-in staff, with
 * the same role rules as the website. Before this check existed, every
 * endpoint answered anyone on the internet.
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";
import { prisma, uid } from "./helpers";
import { getAuthSecret } from "../src/lib/auth-options";
import { POST as login } from "../src/app/api/mobile/auth/login/route";
import * as admissions from "../src/app/api/mobile/admin/admissions/route";
import * as attendance from "../src/app/api/mobile/admin/attendance/route";
import * as billing from "../src/app/api/mobile/admin/billing/route";
import * as dashboard from "../src/app/api/mobile/admin/dashboard/route";
import * as packages from "../src/app/api/mobile/admin/packages/route";
import * as payouts from "../src/app/api/mobile/admin/payouts/route";
import * as reports from "../src/app/api/mobile/admin/reports/route";
import * as students from "../src/app/api/mobile/admin/students/route";
import * as teachers from "../src/app/api/mobile/admin/teachers/route";
import * as timetable from "../src/app/api/mobile/admin/timetable/route";
import * as trainerDashboard from "../src/app/api/mobile/trainer/dashboard/route";
import * as trainerStudents from "../src/app/api/mobile/trainer/students/route";
import * as trainerTimetable from "../src/app/api/mobile/trainer/timetable/route";

type Handler = (req: Request, ctx: unknown) => Promise<Response>;
const BASE = "http://localhost";
const PASSWORD = "fixture-password-123"; // scripts/test-fixtures.ts

const ENDPOINTS: [string, string, Handler][] = [
  ["GET", "/api/mobile/admin/admissions", admissions.GET as Handler],
  ["GET", "/api/mobile/admin/attendance", attendance.GET as Handler],
  ["POST", "/api/mobile/admin/attendance", attendance.POST as Handler],
  ["GET", "/api/mobile/admin/billing", billing.GET as Handler],
  ["POST", "/api/mobile/admin/billing", billing.POST as Handler],
  ["GET", "/api/mobile/admin/dashboard", dashboard.GET as Handler],
  ["GET", "/api/mobile/admin/packages", packages.GET as Handler],
  ["GET", "/api/mobile/admin/payouts", payouts.GET as Handler],
  ["GET", "/api/mobile/admin/reports", reports.GET as Handler],
  ["GET", "/api/mobile/admin/students", students.GET as Handler],
  ["GET", "/api/mobile/admin/teachers", teachers.GET as Handler],
  ["GET", "/api/mobile/admin/timetable", timetable.GET as Handler],
  ["GET", "/api/mobile/trainer/dashboard", trainerDashboard.GET as Handler],
  ["GET", "/api/mobile/trainer/students", trainerStudents.GET as Handler],
  ["GET", "/api/mobile/trainer/timetable", trainerTimetable.GET as Handler],
];

function call(handler: Handler, method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return handler(new Request(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), {});
}

async function signIn(email: string, password = PASSWORD) {
  const res = await (login as Handler)(
    new Request(`${BASE}/api/mobile/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
    {}
  );
  return { status: res.status, json: (await res.json()) as { token?: string; error?: string; user?: { teacherId?: string } } };
}

async function tokenFor(email: string): Promise<string> {
  const { status, json } = await signIn(email);
  assert.equal(status, 200, `sign-in failed for ${email}: ${json.error}`);
  assert.ok(json.token);
  return json.token;
}

const tokens: Record<string, string> = {};
let rahulTeacherId = "";
let priyaTeacherId = "";

before(async () => {
  for (const [name, email] of [
    ["owner", "admin@xellotuition.com"],
    ["coordinator", "coordinator@xellotuition.com"],
    ["accounts", "accounts@xellotuition.com"],
    ["rahul", "teacher.rahul@xellotuition.com"],
  ]) {
    tokens[name] = await tokenFor(email);
  }
  rahulTeacherId = (await prisma.user.findUniqueOrThrow({ where: { email: "teacher.rahul@xellotuition.com" } })).teacherId!;
  priyaTeacherId = (await prisma.user.findUniqueOrThrow({ where: { email: "teacher.priya@xellotuition.com" } })).teacherId!;
});

describe("phone app API: signing in", () => {
  test("every endpoint refuses a request without a token", async () => {
    for (const [method, path, handler] of ENDPOINTS) {
      const res = await call(handler, method, path, undefined, method === "POST" ? {} : undefined);
      assert.equal(res.status, 401, `${method} ${path} answered without signing in`);
    }
  });

  test("the old unsigned token format (base64 JSON) is refused", async () => {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "admin@xellotuition.com" } });
    const forged = Buffer.from(
      JSON.stringify({ userId: owner.id, email: owner.email, role: "OWNER", teacherId: null, timestamp: Date.now() })
    ).toString("base64");
    for (const [method, path, handler] of ENDPOINTS) {
      const res = await call(handler, method, path, forged, method === "POST" ? {} : undefined);
      assert.equal(res.status, 401, `${method} ${path} accepted a forged token`);
    }
  });

  test("a website session token is not accepted as a phone token", async () => {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "admin@xellotuition.com" } });
    const webToken = await encode({ token: { id: owner.id, sv: owner.sessionVersion }, secret: getAuthSecret() });
    const res = await call(students.GET as Handler, "GET", "/api/mobile/admin/students", webToken);
    assert.equal(res.status, 401);
  });

  test("wrong password, unknown email and the published demo password are refused", async () => {
    assert.equal((await signIn("admin@xellotuition.com", "wrong-password-123")).status, 401);
    assert.equal((await signIn(`${uid("nobody")}@example.test`)).status, 401);
    assert.equal((await signIn("admin@xellotuition.com", "demo123")).status, 401);
  });

  test("a password change or deactivation ends the phone session", async () => {
    const email = `${uid("phone")}@example.test`;
    const user = await prisma.user.create({
      data: { name: "Phone Test Coordinator", email, role: "COORDINATOR", passwordHash: await bcrypt.hash(PASSWORD, 4) },
    });
    const token = await tokenFor(email);
    const path = "/api/mobile/admin/students";
    assert.equal((await call(students.GET as Handler, "GET", path, token)).status, 200);

    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    assert.equal((await call(students.GET as Handler, "GET", path, token)).status, 401, "token survived a password change");

    const fresh = await tokenFor(email);
    await prisma.user.update({ where: { id: user.id }, data: { active: false } });
    assert.equal((await call(students.GET as Handler, "GET", path, fresh)).status, 401, "token survived deactivation");
    assert.equal((await signIn(email)).status, 401, "a deactivated login could sign in");
  });
});

describe("phone app API: same role rules as the website", () => {
  // [role, method, path, expected status]
  const matrix: [string, string, string, number][] = [
    ["owner", "GET", "/api/mobile/admin/students", 200],
    ["owner", "GET", "/api/mobile/admin/billing", 200],
    ["owner", "GET", "/api/mobile/admin/attendance", 200],
    ["owner", "GET", "/api/mobile/admin/payouts", 200],
    ["coordinator", "GET", "/api/mobile/admin/dashboard", 200],
    ["coordinator", "GET", "/api/mobile/admin/timetable", 200],
    ["coordinator", "GET", "/api/mobile/admin/admissions", 200],
    ["coordinator", "GET", "/api/mobile/admin/packages", 200],
    ["coordinator", "GET", "/api/mobile/admin/billing", 403], // invoices: owner and accounts only
    ["coordinator", "POST", "/api/mobile/admin/billing", 403],
    ["coordinator", "GET", "/api/mobile/admin/payouts", 403],
    ["accounts", "GET", "/api/mobile/admin/billing", 200],
    ["accounts", "GET", "/api/mobile/admin/students", 200],
    ["accounts", "GET", "/api/mobile/admin/attendance", 403], // attendance: owner and coordinator only
    ["accounts", "POST", "/api/mobile/admin/attendance", 403],
    ["accounts", "GET", "/api/mobile/admin/dashboard", 403],
    ["accounts", "GET", "/api/mobile/admin/admissions", 403],
    ["rahul", "GET", "/api/mobile/admin/students", 403], // trainers never see the full directory
    ["rahul", "GET", "/api/mobile/admin/billing", 403],
    ["rahul", "GET", "/api/mobile/admin/reports", 403],
    ["owner", "GET", "/api/mobile/trainer/dashboard", 403], // trainer screens are for trainer logins
  ];
  for (const [role, method, path, expected] of matrix) {
    test(`${role}: ${method} ${path} -> ${expected}`, async () => {
      const handler = ENDPOINTS.find(([m, p]) => m === method && p === path)![2];
      const res = await call(handler, method, path, tokens[role], method === "POST" ? {} : undefined);
      assert.equal(res.status, expected);
    });
  }

  test("money figures in the reports are only sent to owner and accounts", async () => {
    const coordinator = await (await call(reports.GET as Handler, "GET", "/api/mobile/admin/reports", tokens.coordinator)).json();
    assert.equal(coordinator.metrics.totalInvoicedRevenue, undefined);
    assert.equal(coordinator.metrics.totalPendingDues, undefined);
    assert.equal(typeof coordinator.metrics.activeStudents, "number");
    const owner = await (await call(reports.GET as Handler, "GET", "/api/mobile/admin/reports", tokens.owner)).json();
    assert.equal(typeof owner.metrics.totalInvoicedRevenue, "number");
  });

  test("a trainer sees only their own classes, whatever teacherId the app sends", async () => {
    const own = await call(trainerStudents.GET as Handler, "GET", `/api/mobile/trainer/students?teacherId=${rahulTeacherId}`, tokens.rahul);
    assert.equal(own.status, 200);
    const implicit = await call(trainerTimetable.GET as Handler, "GET", "/api/mobile/trainer/timetable", tokens.rahul);
    assert.equal(implicit.status, 200);
    for (const handler of [trainerDashboard.GET, trainerStudents.GET, trainerTimetable.GET] as Handler[]) {
      const other = await call(handler, "GET", `/api/mobile/trainer/students?teacherId=${priyaTeacherId}`, tokens.rahul);
      assert.equal(other.status, 403);
    }
  });
});

after(async () => {
  await prisma.$disconnect();
});
