import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { dayRangeInZone } from "../src/lib/zoned-time";

describe("IST day ranges (reports)", () => {
  test("7–8 Oct covers 7 Oct 00:00 IST up to (not including) 9 Oct 00:00 IST, on any server clock", () => {
    const range = dayRangeInZone("2026-10-07", "2026-10-08")!;
    assert.equal(range.gte.toISOString(), "2026-10-06T18:30:00.000Z");
    assert.equal(range.lt.toISOString(), "2026-10-08T18:30:00.000Z");
  });

  test("a payment at 00:10 IST on the first day is inside; 00:10 IST the day after is outside", () => {
    const range = dayRangeInZone("2026-10-07", "2026-10-08")!;
    const inside = new Date("2026-10-06T18:40:00.000Z");
    const after = new Date("2026-10-08T18:40:00.000Z");
    assert.ok(inside >= range.gte && inside < range.lt);
    assert.ok(!(after < range.lt));
  });

  test("date-only values saved as UTC midnight stay on their calendar day", () => {
    const range = dayRangeInZone("2026-10-08", "2026-10-08")!;
    const saved = new Date("2026-10-08"); // how a date-only form value is stored
    assert.ok(saved >= range.gte && saved < range.lt);
  });

  test("reversed or malformed ranges are refused", () => {
    assert.equal(dayRangeInZone("2026-10-09", "2026-10-08"), null);
    assert.equal(dayRangeInZone("07/10/2026", "2026-10-08"), null);
  });
});
