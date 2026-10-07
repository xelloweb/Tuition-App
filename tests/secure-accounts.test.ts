/**
 * Deploy safety step (scripts/secure-accounts.ts) on throwaway databases:
 * published and shared setup passwords are switched off, the owner keeps access
 * through SEED_ADMIN_PASSWORD, sessions end, nothing secret is printed, and a
 * second run changes nothing. Also covers the one-time security reset for the
 * 7–8 Oct 2026 exposure and owner recovery from the hosting account.
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(__dirname, "..");
const dir = mkdtempSync(path.join(tmpdir(), "xello-secure-"));
const url = `file:${path.join(dir, "secure.db")}`;
const SEED_PASSWORD = "seed-password-for-tests-1";
let db: PrismaClient;

const INCIDENT_ACTION = "SECURITY_RESET_2026_10_08";

function runScript(env: Record<string, string | undefined>, databaseUrl = url) {
  const result = spawnSync("npx", ["tsx", "scripts/secure-accounts.ts"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl, NEXTAUTH_URL: "https://example.test", OWNER_PASSWORD_RESET: "", ...env },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function migrateDb(databaseUrl: string) {
  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8" });
  assert.equal(migrate.status, 0, migrate.stderr);
}

describe("deploy safety step: published and shared passwords", () => {
  before(async () => {
    migrateDb(url);
    db = new PrismaClient({ datasourceUrl: url });
    // The one-time security reset is covered separately below.
    await db.auditLog.create({ data: { entityType: "SYSTEM", entityId: "security", action: INCIDENT_ACTION, actorRole: "SYSTEM", actorName: "test", details: "{}" } });
    const demo = await bcrypt.hash("demo123", 10);
    const shared = await bcrypt.hash(SEED_PASSWORD, 10);
    const own = await bcrypt.hash("a-trainer-own-password", 10);
    await db.user.createMany({
      data: [
        { id: "u-owner", email: "owner@example.test", name: "Owner", role: "OWNER", passwordHash: demo },
        { id: "u-coord", email: "coord@example.test", name: "Coordinator", role: "COORDINATOR", passwordHash: demo },
        { id: "u-acc", email: "acc@example.test", name: "Accounts", role: "ACCOUNTS", passwordHash: shared },
        { id: "u-trainer", email: "trainer@example.test", name: "Trainer", role: "TEACHER", passwordHash: own },
      ],
    });
  });

  after(async () => {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  test("does nothing outside production", () => {
    assert.match(runScript({ NODE_ENV: "development", SEED_ADMIN_PASSWORD: SEED_PASSWORD }), /development build, nothing to do/);
  });

  test("switches off published and shared passwords, keeps the owner's access, ends sessions", async () => {
    const out = runScript({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: SEED_PASSWORD });
    assert.doesNotMatch(out, new RegExp(SEED_PASSWORD), "the setup password is never printed");
    assert.doesNotMatch(out, /\$2[aby]\$/, "no password hash is printed");

    const users = new Map((await db.user.findMany()).map((u) => [u.id, u]));
    assert.ok(await bcrypt.compare(SEED_PASSWORD, users.get("u-owner")!.passwordHash!), "owner now uses SEED_ADMIN_PASSWORD");
    assert.equal(users.get("u-coord")!.passwordHash, null, "published password cleared");
    assert.equal(users.get("u-acc")!.passwordHash, null, "shared setup password cleared");
    assert.ok(await bcrypt.compare("a-trainer-own-password", users.get("u-trainer")!.passwordHash!), "own passwords untouched");
    for (const id of ["u-owner", "u-coord", "u-acc"]) assert.equal(users.get(id)!.sessionVersion, 1, `${id} sessions ended`);
    assert.equal(users.get("u-trainer")!.sessionVersion, 0);

    const audit = await db.auditLog.findMany({ where: { actorRole: "SYSTEM", NOT: { action: INCIDENT_ACTION } } });
    assert.equal(audit.length, 3);
  });

  test("a second run changes nothing", async () => {
    const before = await db.user.findMany({ orderBy: { id: "asc" } });
    assert.match(runScript({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: SEED_PASSWORD }), /no login uses a published or shared setup password/);
    const afterRun = await db.user.findMany({ orderBy: { id: "asc" } });
    assert.deepEqual(afterRun.map((u) => [u.id, u.passwordHash, u.sessionVersion]), before.map((u) => [u.id, u.passwordHash, u.sessionVersion]));
  });

  test("without a usable SEED_ADMIN_PASSWORD the owner gets a one-time link instead of a dead end", async () => {
    await db.user.update({ where: { id: "u-owner" }, data: { passwordHash: await bcrypt.hash("demo123", 10) } });
    const out = runScript({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: "" });
    assert.match(out, /setup-password\?token=[0-9a-f]{64}/);
    const owner = await db.user.findUniqueOrThrow({ where: { id: "u-owner" } });
    assert.equal(owner.passwordHash, null);
    assert.ok(owner.inviteToken && owner.inviteExpiresAt && owner.inviteExpiresAt > new Date());
  });
});

describe("one-time security reset and owner recovery (8 Oct 2026)", () => {
  const dir2 = mkdtempSync(path.join(tmpdir(), "xello-incident-"));
  const url2 = `file:${path.join(dir2, "incident.db")}`;
  const ATTACKER_SET = "attacker-chosen-password";
  let db2: PrismaClient;

  before(async () => {
    migrateDb(url2);
    db2 = new PrismaClient({ datasourceUrl: url2 });
    await db2.user.createMany({
      data: [
        { id: "o", email: "owner@example.test", name: "Owner", role: "OWNER", passwordHash: await bcrypt.hash(ATTACKER_SET, 10), sessionVersion: 2 },
        { id: "c", email: "coord@example.test", name: "Coordinator", role: "COORDINATOR", passwordHash: await bcrypt.hash(ATTACKER_SET, 10), inviteToken: "a".repeat(64), inviteExpiresAt: new Date(Date.now() + 86_400_000) },
        { id: "t", email: "trainer@example.test", name: "Trainer", role: "TEACHER", passwordHash: await bcrypt.hash("trainer-own-password", 10) },
        { id: "x", email: "legacy@example.test", name: "Legacy", role: "ACCOUNTS", passwordHash: await bcrypt.hash("xelloadmin1234", 10) },
      ],
    });
    // The trainer and the legacy login were last changed before the exposure began.
    await db2.user.update({ where: { id: "t" }, data: { updatedAt: new Date("2026-10-01T05:00:00Z") } });
    await db2.user.update({ where: { id: "x" }, data: { updatedAt: new Date("2026-10-01T05:00:00Z") } });
  });

  after(async () => {
    await db2.$disconnect();
    rmSync(dir2, { recursive: true, force: true });
  });

  test("signs everyone out, gives the owner the hosting password and clears logins changed during the exposure", async () => {
    const out = runScript({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: SEED_PASSWORD }, url2);
    assert.match(out, /all 4 logins were signed out/);
    assert.doesNotMatch(out, new RegExp(SEED_PASSWORD));
    assert.doesNotMatch(out, /\$2[aby]\$/);

    const users = new Map((await db2.user.findMany()).map((u) => [u.id, u]));
    const owner = users.get("o")!;
    assert.ok(await bcrypt.compare(SEED_PASSWORD, owner.passwordHash!), "owner password replaced, attacker's no longer works");
    assert.equal(owner.sessionVersion, 3);
    assert.equal(users.get("c")!.passwordHash, null, "login changed during the exposure needs a new link");
    assert.equal(users.get("c")!.inviteToken, null, "links handed out by the open reset form are cancelled");
    assert.ok(await bcrypt.compare("trainer-own-password", users.get("t")!.passwordHash!), "untouched logins keep their password");
    for (const id of ["c", "t"]) assert.equal(users.get(id)!.sessionVersion, 1, `${id} signed out`);
    assert.equal(users.get("x")!.passwordHash, null, "the published owner password is switched off wherever it is used");

    const marker = await db2.auditLog.findMany({ where: { action: INCIDENT_ACTION } });
    assert.equal(marker.length, 1);
    assert.equal(JSON.parse(marker[0].details).staffPasswordsCleared, 1);
  });

  test("runs only once", async () => {
    const before = await db2.user.findMany({ orderBy: { id: "asc" } });
    const out = runScript({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: SEED_PASSWORD }, url2);
    assert.doesNotMatch(out, /Security reset/);
    const afterRun = await db2.user.findMany({ orderBy: { id: "asc" } });
    assert.deepEqual(afterRun.map((u) => [u.id, u.passwordHash, u.sessionVersion]), before.map((u) => [u.id, u.passwordHash, u.sessionVersion]));
  });

  test("the owner recovers a forgotten password only with the deliberate hosting setting", async () => {
    const NEW_SEED = "a-brand-new-hosting-password";
    runScript({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: NEW_SEED }, url2);
    let owner = await db2.user.findUniqueOrThrow({ where: { id: "o" } });
    assert.ok(await bcrypt.compare(SEED_PASSWORD, owner.passwordHash!), "a changed SEED_ADMIN_PASSWORD alone changes nothing");

    const out = runScript({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: NEW_SEED, OWNER_PASSWORD_RESET: "reset-owner-password" }, url2);
    assert.match(out, /Remove OWNER_PASSWORD_RESET/);
    owner = await db2.user.findUniqueOrThrow({ where: { id: "o" } });
    assert.ok(await bcrypt.compare(NEW_SEED, owner.passwordHash!));
    assert.equal(owner.sessionVersion, 4, "old owner sessions end");
    const trainer = await db2.user.findUniqueOrThrow({ where: { id: "t" } });
    assert.ok(await bcrypt.compare("trainer-own-password", trainer.passwordHash!), "only owner logins are reset");
    assert.equal(await db2.auditLog.count({ where: { action: "OWNER_PASSWORD_RESET_FROM_HOSTING" } }), 1);

    const refused = runScript({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: "short", OWNER_PASSWORD_RESET: "reset-owner-password" }, url2);
    assert.match(refused, /Nothing changed/);
  });
});
