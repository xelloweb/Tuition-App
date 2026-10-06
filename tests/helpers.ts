/**
 * Shared fixtures for the regression tests. Every record uses fictional data
 * and a per-run suffix, so tests never collide with each other or with seed data.
 *
 * Run through `npm test`, which points DATABASE_URL at a disposable database.
 */
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { DEMO_USERS } from "../src/lib/auth";

const url = process.env.DATABASE_URL ?? "";
const devDb = path.resolve(__dirname, "..", "prisma", "dev.db");
if (!url || url === "file:./dev.db" || (url.startsWith("file:") && path.resolve(url.slice(5)) === devDb)) {
  throw new Error(
    "Refusing to run tests against the development database. Use `npm test`, which creates a disposable test database."
  );
}

export { prisma };
export const owner = DEMO_USERS.admin;
export const coordinator = DEMO_USERS.coordinator;
export const accounts = DEMO_USERS.accounts;

let counter = 0;
export const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const uid = (label: string) => `${label}-${runId}-${++counter}`;

export async function makeSubject(name: string) {
  return prisma.subject.create({ data: { name: uid(name), code: uid("C").slice(0, 20), category: "Academic" } });
}

export async function makeTeacher(name: string, opts: { timeZone?: string; active?: boolean } = {}) {
  const id = uid(name.replace(/\W+/g, "").toLowerCase());
  return prisma.teacher.create({
    data: {
      name: `${name} ${runId}`,
      email: `${id}@example.test`,
      phone: "+91 98470 12345",
      subjects: name,
      grades: "10th Grade",
      timeZone: opts.timeZone ?? "Asia/Kolkata",
      active: opts.active ?? true,
      defaultRate: 600,
    },
  });
}

export async function makeStudent(opts: { timeZone?: string; country?: string; status?: string } = {}) {
  const guardian = await prisma.guardian.create({
    data: { name: `Test Guardian ${runId}`, whatsappNumber: "+971 50 000 0000", country: opts.country ?? "UAE", timeZone: opts.timeZone ?? "Asia/Dubai" },
  });
  return prisma.student.create({
    data: {
      studentCode: uid("TST"),
      name: `Test Student ${uid("s")}`,
      grade: "10th Grade",
      guardianId: guardian.id,
      guardianName: guardian.name,
      whatsappNumber: guardian.whatsappNumber,
      country: opts.country ?? "UAE",
      timeZone: opts.timeZone ?? "Asia/Dubai",
      status: opts.status ?? "ACTIVE",
    },
  });
}

export async function enrol(studentId: string, subjectId: string, teacherId: string | null) {
  return prisma.subjectEnrollment.create({ data: { studentId, subjectId, teacherId, status: "ACTIVE" } });
}

export async function makePackage(
  studentId: string,
  allocations: { subjectId: string; credits: number }[],
  opts: { totalCredits?: number; startDate?: Date; expiryDate?: Date | null; durationMinutes?: number; status?: string } = {}
) {
  const total = opts.totalCredits ?? allocations.reduce((s, a) => s + a.credits, 0);
  return prisma.studentPackage.create({
    data: {
      packageNumber: uid("PKG-T"),
      studentId,
      name: "Test package",
      totalCredits: total,
      price: 0,
      startDate: opts.startDate ?? new Date(Date.now() - 24 * 3600 * 1000),
      expiryDate: opts.expiryDate ?? null,
      durationMinutes: opts.durationMinutes ?? 60,
      status: opts.status ?? "ACTIVE",
      allocations: { create: allocations.map((a) => ({ subjectId: a.subjectId, allocatedCredits: a.credits })) },
    },
  });
}

/** Asserts that an async call rejects with an ApiError carrying the given field error. */
export async function expectFieldError(promise: Promise<unknown>, predicate: (fieldErrors: Record<string, string>) => boolean) {
  try {
    await promise;
  } catch (err) {
    const fieldErrors = (err as { fieldErrors?: Record<string, string> }).fieldErrors ?? {};
    if (predicate(fieldErrors)) return fieldErrors;
    throw new Error(`Unexpected field errors: ${JSON.stringify(fieldErrors)} (${(err as Error).message})`);
  }
  throw new Error("Expected the call to be rejected, but it succeeded.");
}
