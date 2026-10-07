/**
 * Server side of the trainer import (fictional people only).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma, coordinator, uid } from "./helpers";
import { importTeachers } from "../src/lib/services/teachers";
import { ApiError } from "../src/lib/api-errors";

const row = (n: number, overrides: Record<string, unknown> = {}) => ({
  name: `Import Trainer ${n} ${uid("i")}`,
  email: `${uid(`import${n}`)}@example.test`,
  phone: `+91 9${String(n).padStart(4, "0")} ${String(Date.now()).slice(-5)}`,
  subjects: ["Mathematics"],
  grades: ["High School (9th–10th)"],
  location: "Wandoor",
  qualification: "MSc",
  syllabus: "CBSE, ICSE",
  devices: "Laptop",
  availableDays: ["Mon", "Wed", "Fri"],
  availableTimes: "6 PM – 9 PM",
  whatsapp: null,
  notes: "From the trainer sign-up form (fictional test row).",
  ...overrides,
});

describe("trainer import (server)", () => {
  test("a check saves nothing; the import creates active IST trainers with their details and an audit entry each", async () => {
    const rows = [row(1), row(2)];
    const before = await prisma.teacher.count();
    const check = await importTeachers(rows, coordinator, { dryRun: true });
    assert.deepEqual(check.results.map((r) => r.status), ["ready", "ready"]);
    assert.equal(await prisma.teacher.count(), before);

    const done = await importTeachers(rows, coordinator, { dryRun: false });
    assert.equal(done.created, 2);
    const t = await prisma.teacher.findFirstOrThrow({ where: { email: rows[0].email as string } });
    assert.equal(t.active, true);
    assert.equal(t.timeZone, "Asia/Kolkata");
    assert.equal(t.location, "Wandoor");
    assert.equal(t.availableDays, "Mon, Wed, Fri");
    assert.equal(t.syllabus, "CBSE, ICSE");
    assert.equal(t.defaultRate, 500, "standard rate until the owner sets one");
    assert.equal(await prisma.auditLog.count({ where: { entityId: t.id, action: "IMPORT_TEACHER" } }), 1);

    const again = await importTeachers(rows, coordinator, { dryRun: false });
    assert.equal(again.created, 0);
    assert.deepEqual(again.results.map((r) => r.status), ["exists", "exists"], "re-importing skips people already added");
  });

  test("a phone saved without +91 still counts as the same number; duplicates in one paste are refused", async () => {
    const digits = `9${String(Date.now()).slice(-9)}`;
    await prisma.teacher.create({
      data: { name: `Bare Phone ${uid("b")}`, email: `${uid("bare")}@example.test`, phone: digits, subjects: "Physics", grades: "10th Grade" },
    });
    const sameNumber = row(3, { phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` });
    const twinA = row(4);
    const twinB = row(5, { email: twinA.email });
    const result = await importTeachers([sameNumber, twinA, twinB], coordinator, { dryRun: true });
    assert.equal(result.results[0].status, "exists");
    assert.match(result.results[0].messages[0], /already belongs to trainer/);
    assert.equal(result.results[1].status, "ready");
    assert.equal(result.results[2].status, "invalid");
  });

  test("invalid rows are reported and skipped; pay rates in a row are ignored", async () => {
    const bad = row(6, { phone: "12345" });
    const withRate = row(7, { defaultRate: 99999, gradeRates: { PLUS_TWO: 99999 } });
    const result = await importTeachers([bad, withRate], coordinator, { dryRun: false });
    assert.equal(result.results[0].status, "invalid");
    assert.equal(result.created, 1);
    const created = await prisma.teacher.findFirstOrThrow({ where: { email: withRate.email as string } });
    assert.equal(created.defaultRate, 500);
    assert.equal(created.gradeRates, null);
  });

  test("empty and oversized imports are refused", async () => {
    await assert.rejects(importTeachers([], coordinator, { dryRun: true }), (e: unknown) => e instanceof ApiError && e.status === 400);
    await assert.rejects(importTeachers(Array.from({ length: 301 }, (_, i) => row(i)), coordinator, { dryRun: true }), (e: unknown) => e instanceof ApiError && e.status === 400);
  });
});
