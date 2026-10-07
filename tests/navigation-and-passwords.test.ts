import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mobileMoreFor, mobilePrimaryFor, navGroupsFor } from "../src/components/layout/navigation";
import { isPublishedPassword, newPasswordProblem } from "../src/lib/password-rules";

const hrefs = (role: string) => navGroupsFor(role).flatMap((g) => g.items.map((i) => i.href));

describe("navigation", () => {
  test("each role sees only its own areas", () => {
    assert.deepEqual(
      hrefs("TEACHER").sort(),
      ["/", "/attendance", "/payouts", "/progress", "/students", "/teachers", "/timetable"].sort()
    );
    for (const hidden of ["/billing", "/dues", "/packages", "/reports", "/settings", "/users"]) {
      assert.ok(!hrefs("TEACHER").includes(hidden), `trainers do not see ${hidden}`);
    }
    for (const hidden of ["/timetable", "/attendance", "/packages", "/progress", "/settings", "/users"]) {
      assert.ok(!hrefs("ACCOUNTS").includes(hidden), `accounts do not see ${hidden}`);
    }
    for (const hidden of ["/billing", "/payouts", "/users"]) {
      assert.ok(!hrefs("COORDINATOR").includes(hidden), `coordinators do not see ${hidden}`);
    }
    assert.ok(hrefs("OWNER").includes("/users"));
  });

  test("trainers see their own wording", () => {
    const labels = navGroupsFor("TEACHER").flatMap((g) => g.items.map((i) => i.label));
    assert.ok(labels.includes("My classes") && labels.includes("My students") && labels.includes("My earnings"));
    assert.ok(!labels.some((l) => /teacher/i.test(l)), "one term: Trainer");
  });

  test("phones: at most four bar destinations plus More, and every page is reachable exactly once", () => {
    for (const role of ["OWNER", "COORDINATOR", "ACCOUNTS", "TEACHER"]) {
      const primary = mobilePrimaryFor(role).map((i) => i.href);
      const more = mobileMoreFor(role).flatMap((g) => g.items.map((i) => i.href));
      assert.ok(primary.length <= 4, `${role}: ${primary.length} bar items`);
      assert.deepEqual([...primary, ...more].sort(), hrefs(role).sort(), `${role}: bar + More cover every page once`);
    }
  });
});

describe("password rules", () => {
  test("published passwords are recognised however they are typed", () => {
    assert.ok(isPublishedPassword("demo123"));
    assert.ok(isPublishedPassword(" DEMO123 "));
    assert.ok(!isPublishedPassword("demo1234"));
  });

  test("new passwords need 10+ characters and must not be published", () => {
    assert.match(newPasswordProblem("short") ?? "", /at least 10/);
    assert.equal(newPasswordProblem("a-long-enough-passphrase"), null);
    assert.match(newPasswordProblem("x".repeat(201)) ?? "", /200/);
  });
});
