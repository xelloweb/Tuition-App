/**
 * Deploy safety step (scripts/secure-accounts.ts) on its own throwaway database:
 * published and shared setup passwords are switched off, the owner keeps access
 * through SEED_ADMIN_PASSWORD, sessions end, nothing secret is printed, and a
 * second run changes nothing.
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

function runScript(env: Record<string, string | undefined>) {
  const result = spawnSync("npx", ["tsx", "scripts/secure-accounts.ts"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url, NEXTAUTH_URL: "https://example.test", ...env },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

describe("deploy safety step: published and shared passwords", () => {
  before(async () => {
    const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], { cwd: root, env: { ...process.env, DATABASE_URL: url }, encoding: "utf8" });
    assert.equal(migrate.status, 0, migrate.stderr);
    db = new PrismaClient({ datasourceUrl: url });
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

    const audit = await db.auditLog.findMany({ where: { actorRole: "SYSTEM" } });
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
