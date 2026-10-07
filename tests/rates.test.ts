import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  tierForGrade,
  getTeacherRateForGrade,
  getTierRate,
  defaultTierRate,
  STANDARD_TIER_RATES,
} from "../src/lib/rates";

describe("standard hourly pay rates", () => {
  test("standard tier rates match specifications", () => {
    assert.equal(STANDARD_TIER_RATES.PRIMARY, 150, "KG to 5th is 150");
    assert.equal(STANDARD_TIER_RATES.MIDDLE, 150, "6th to 7th is 150");
    assert.equal(STANDARD_TIER_RATES.SECONDARY, 150, "8th to 9th is 150");
    assert.equal(STANDARD_TIER_RATES.TENTH, 150, "10th Standard is 150");
    assert.equal(STANDARD_TIER_RATES.PLUS_ONE, 200, "Plus One is 200");
    assert.equal(STANDARD_TIER_RATES.PLUS_TWO, 200, "Plus Two is 200");
  });

  test("defaultTierRate returns standard rates for default base", () => {
    assert.equal(defaultTierRate(150, "PRIMARY"), 150);
    assert.equal(defaultTierRate(150, "MIDDLE"), 150);
    assert.equal(defaultTierRate(150, "SECONDARY"), 150);
    assert.equal(defaultTierRate(150, "TENTH"), 150);
    assert.equal(defaultTierRate(150, "PLUS_ONE"), 200);
    assert.equal(defaultTierRate(150, "PLUS_TWO"), 200);
  });

  test("grade classification covers KG to 5th at 150/hr", () => {
    const grades = ["KG", "LKG", "UKG", "1st Standard", "2nd Grade", "3", "4th", "5th Standard", "Class 5"];
    for (const g of grades) {
      assert.equal(tierForGrade(g), "PRIMARY", `Expected PRIMARY for ${g}`);
      assert.equal(getTeacherRateForGrade(null, g), 150, `Expected 150 for ${g}`);
    }
  });

  test("grade classification covers 6th to 7th at 150/hr", () => {
    const grades = ["6th Standard", "7th Standard", "Class 6", "Class 7", "6", "7"];
    for (const g of grades) {
      assert.equal(tierForGrade(g), "MIDDLE", `Expected MIDDLE for ${g}`);
      assert.equal(getTeacherRateForGrade(null, g), 150, `Expected 150 for ${g}`);
    }
  });

  test("grade classification covers 8th to 9th at 150/hr", () => {
    const grades = ["8th Standard", "9th Grade", "8", "9", "Class 8", "Class 9"];
    for (const g of grades) {
      assert.equal(tierForGrade(g), "SECONDARY", `Expected SECONDARY for ${g}`);
      assert.equal(getTeacherRateForGrade(null, g), 150, `Expected 150 for ${g}`);
    }
  });

  test("grade classification covers 10th Standard at 150/hr", () => {
    const grades = ["10th Standard", "10", "10th Grade", "SSLC"];
    for (const g of grades) {
      assert.equal(tierForGrade(g), "TENTH", `Expected TENTH for ${g}`);
      assert.equal(getTeacherRateForGrade(null, g), 150, `Expected 150 for ${g}`);
    }
  });

  test("grade classification covers Plus One & Plus Two at 200/hr", () => {
    const plusOneGrades = ["Plus One", "+1", "11th Grade", "11", "Plus One (+1)"];
    for (const g of plusOneGrades) {
      assert.equal(tierForGrade(g), "PLUS_ONE", `Expected PLUS_ONE for ${g}`);
      assert.equal(getTeacherRateForGrade(null, g), 200, `Expected 200 for ${g}`);
    }

    const plusTwoGrades = ["Plus Two", "+2", "12th Grade", "12", "Plus Two (+2)", "NEET", "JEE"];
    for (const g of plusTwoGrades) {
      assert.equal(tierForGrade(g), "PLUS_TWO", `Expected PLUS_TWO for ${g}`);
      assert.equal(getTeacherRateForGrade(null, g), 200, `Expected 200 for ${g}`);
    }
  });

  test("teacher with explicit overrides is respected", () => {
    const teacher = {
      defaultRate: 150,
      gradeRates: JSON.stringify({ PRIMARY: 180, PLUS_TWO: 250 }),
    };
    assert.equal(getTierRate(teacher, "PRIMARY"), 180);
    assert.equal(getTierRate(teacher, "TENTH"), 150);
    assert.equal(getTierRate(teacher, "PLUS_TWO"), 250);
  });
});
