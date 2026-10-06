#!/usr/bin/env node
/**
 * Runs the acceptance scenarios and regression tests against a disposable
 * SQLite database, so tests never write into prisma/dev.db (which is bundled
 * for deployment). Set KEEP_TEST_DB=1 to keep the database for inspection.
 * Set TEST_BASE_URL to also run the HTTP tests against a running server.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(path.join(tmpdir(), "xello-test-"));
const env = { ...process.env, DATABASE_URL: `file:${path.join(dir, "test.db")}` };

function run(label, command, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit code ${result.status ?? "signal"})`);
  }
}

let failed = false;
try {
  run("Apply migrations to a fresh test database", "npx", ["prisma", "migrate", "deploy"]);
  run("Seed fictional demo data", "npx", ["tsx", "prisma/seed.ts"]);
  run("Acceptance scenarios", "npx", ["tsx", "scripts/run-acceptance-tests.ts"]);
  const files = readdirSync(path.join(root, "tests"))
    .filter((f) => f.endsWith(".test.ts") && (process.env.TEST_BASE_URL || f !== "http.test.ts"))
    .map((f) => path.join("tests", f));
  run("Regression tests", "node", ["--import", "tsx", "--test", "--test-concurrency=1", ...files]);
} catch (err) {
  failed = true;
  console.error(`\n✖ ${err.message}`);
} finally {
  if (process.env.KEEP_TEST_DB) console.log(`\nTest database kept at ${dir}`);
  else rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
