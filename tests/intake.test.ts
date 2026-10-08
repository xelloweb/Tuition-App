/**
 * Parent admission form rules and safeguards: phone numbers from India and the
 * GCC, required fields, IST-only preferred times, form tokens, rate limits,
 * references and the privacy-notice launch gate.
 */
import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { formatPhone, normalizeParentPhone, validateIntake } from "../src/lib/intake";
import { allowSubmission, checkFormToken, intakeOpen, issueFormToken, newReference, privacyNoticeUrl, resetRateLimits } from "../src/lib/intake-server";

const TODAY = "2026-10-08";

function valid(extra: Record<string, unknown> = {}) {
  return {
    studentName: "Fictional Student",
    grade: "10th Grade",
    board: "CBSE",
    schoolName: "",
    medium: "",
    subjectIds: ["s-math", "s-phys"],
    guardianName: "Fictional Parent",
    relationship: "Mother",
    whatsappNumber: "+971 50 123 4567",
    altPhone: "",
    email: "Parent@Example.TEST",
    country: "UAE",
    city: "",
    helpAreas: "Algebra",
    teachingLanguage: "English",
    startDate: "",
    notes: "",
    preferences: [
      { subjectId: "s-math", weekday: 1, start: "17:00", end: "18:00" },
      { subjectId: "s-math", weekday: 3, start: "17:00", end: "18:00" },
      { subjectId: "s-phys", weekday: 5, start: "19:30", end: "20:30" },
    ],
    consent: true,
    ...extra,
  };
}
const offered = new Set(["s-math", "s-phys", "s-chem"]);
const check = (body: Record<string, unknown>) => validateIntake(body, { subjectIds: offered, todayIst: TODAY });

describe("parent form: phone numbers", () => {
  test("India and GCC numbers are accepted however parents type them", () => {
    const cases: [string, string, string][] = [
      ["98470 12345", "India", "+91 98470 12345"],
      ["91234 56789", "India", "+91 91234 56789"],
      ["919123456789", "India", "+91 91234 56789"],
      ["+91 98470 12345", "UAE", "+91 98470 12345"],
      ["050 123 4567", "UAE", "+971 501234567"],
      ["00971 50 123 4567", "India", "+971 501234567"],
      ["971501234567", "UAE", "+971 501234567"],
      ["+966 5 1234 5678", "Saudi Arabia", "+966 512345678"],
      ["5512 3456", "Qatar", "+974 55123456"],
      ["9123 4567", "Oman", "+968 91234567"],
      ["5123 4567", "Kuwait", "+965 51234567"],
      ["3612 3456", "Bahrain", "+973 36123456"],
    ];
    for (const [typed, country, expected] of cases) {
      const result = check(valid({ whatsappNumber: typed, country }));
      assert.equal(result.data?.whatsappNumber, expected, `${typed} (${country}) ${JSON.stringify(result.errors)}`);
    }
  });

  test("incomplete numbers are refused with a clear message", () => {
    assert.match(check(valid({ whatsappNumber: "98470 1234", country: "India" })).errors.whatsappNumber ?? "", /India numbers need 10 digits/);
    assert.match(check(valid({ whatsappNumber: "+971 50 12", country: "UAE" })).errors.whatsappNumber ?? "", /8–15 digits|UAE/);
    assert.equal(normalizeParentPhone("", "India"), "");
    assert.equal(formatPhone("+919847012345"), "+91 98470 12345");
  });

  test("the alternative number must differ from WhatsApp", () => {
    assert.match(check(valid({ altPhone: "050 123 4567" })).errors.altPhone ?? "", /same as the WhatsApp/);
  });
});

describe("parent form: fields", () => {
  test("a complete form is accepted and normalised", () => {
    const { data, errors } = check(valid());
    assert.deepEqual(errors, {});
    assert.equal(data!.email, "parent@example.test");
    assert.equal(data!.preferences.length, 3, "several preferred times, including two for one subject");
    assert.equal(data!.schoolName, null);
  });

  test("every required answer is reported at once", () => {
    const { data, errors } = check({ consent: false });
    assert.equal(data, null);
    for (const field of ["studentName", "grade", "board", "subjectIds", "guardianName", "relationship", "whatsappNumber", "country", "consent"]) {
      assert.ok(errors[field], `missing error for ${field}`);
    }
    assert.equal(errors.schoolName, undefined, "optional fields stay optional");
  });

  test("only offered subjects, grades and boards are accepted", () => {
    assert.ok(check(valid({ subjectIds: ["s-unknown"], preferences: [] })).errors.subjectIds);
    assert.ok(check(valid({ grade: "Grade 99" })).errors.grade);
    assert.ok(check(valid({ board: "Made-up board" })).errors.board);
    assert.ok(check(valid({ subjectIds: Array.from({ length: 13 }, (_, i) => `s-${i}`), preferences: [] })).errors.subjectIds);
  });

  test("consent must be an explicit yes", () => {
    assert.ok(check(valid({ consent: "true" })).errors.consent);
    assert.ok(check(valid({ consent: undefined })).errors.consent);
  });

  test("long answers are limited and control characters removed", () => {
    assert.ok(check(valid({ helpAreas: "x".repeat(1001) })).errors.helpAreas);
    assert.equal(check(valid({ studentName: "Name\u0000\u0007 Surname" })).data?.studentName, "Name   Surname");
  });

  test("the preferred start date is today or later (IST)", () => {
    assert.ok(check(valid({ startDate: "2026-10-07" })).errors.startDate);
    assert.equal(check(valid({ startDate: TODAY })).data?.startDate, TODAY);
    assert.ok(check(valid({ startDate: "2028-01-01" })).errors.startDate);
  });
});

describe("parent form: preferred times (IST only)", () => {
  test("times are kept exactly as typed: no time-zone conversion for GCC parents", () => {
    const { data } = check(valid({ country: "Saudi Arabia", whatsappNumber: "+966 512345678" }));
    assert.deepEqual(data!.preferences[0], { subjectId: "s-math", weekday: 1, start: "17:00", end: "18:00" });
  });

  test("each preferred time must be a chosen subject, a valid day and a sensible IST window", () => {
    const errors = check(
      valid({
        preferences: [
          { subjectId: "s-chem", weekday: 1, start: "17:00", end: "18:00" },
          { subjectId: "s-math", weekday: 9, start: "17:00", end: "18:00" },
          { subjectId: "s-math", weekday: 2, start: "18:00", end: "17:00" },
          { subjectId: "s-math", weekday: 2, start: "05:00", end: "06:00" },
          { subjectId: "s-math", weekday: 2, start: "10:00", end: "15:00" },
        ],
      })
    ).errors;
    assert.ok(errors["preferences.0.subjectId"], "subject not chosen above");
    assert.ok(errors["preferences.1.weekday"]);
    assert.match(errors["preferences.2.end"], /after the start/);
    assert.match(errors["preferences.3.start"], /between 06:00 and 23:00 IST/);
    assert.match(errors["preferences.4.end"], /4 hours/);
  });

  test("at most 20 preferred times", () => {
    const many = Array.from({ length: 21 }, () => ({ subjectId: "s-math", weekday: 1, start: "17:00", end: "18:00" }));
    assert.ok(check(valid({ preferences: many })).errors.preferences);
  });
});

describe("parent form: safeguards", () => {
  afterEach(() => resetRateLimits());

  test("form tokens: too fast, valid, expired and tampered", () => {
    const t0 = 1_800_000_000_000;
    const token = issueFormToken(t0);
    assert.equal(checkFormToken(token, t0 + 1_000), "too_fast");
    assert.equal(checkFormToken(token, t0 + 5_000), "ok");
    assert.equal(checkFormToken(token, t0 + 25 * 60 * 60 * 1000), "expired");
    const [issued, nonce, sig] = token.split(".");
    assert.equal(checkFormToken(`${Number(issued) - 60_000}.${nonce}.${sig}`, t0 + 5_000), "invalid", "changing the time breaks the signature");
    assert.equal(checkFormToken("not-a-token", t0), "invalid");
    assert.equal(checkFormToken(undefined, t0), "invalid");
  });

  test("rate limit: five forms per connection in ten minutes", () => {
    const t0 = 1_800_000_000_000;
    for (let i = 0; i < 5; i++) assert.ok(allowSubmission("client-a", t0 + i));
    assert.equal(allowSubmission("client-a", t0 + 10), false);
    assert.ok(allowSubmission("client-b", t0 + 10), "other connections are unaffected");
    assert.ok(allowSubmission("client-a", t0 + 11 * 60 * 1000), "allowed again after the window");
  });

  test("references are random and not sequential", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const ref = newReference();
      assert.match(ref, /^XA-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/);
      seen.add(ref);
    }
    assert.equal(seen.size, 2000);
  });

  test("privacy notice: the public form does not launch in production without it", () => {
    const saved = { url: process.env.PRIVACY_NOTICE_URL, env: process.env.NODE_ENV };
    const env = process.env as Record<string, string | undefined>;
    try {
      delete env.PRIVACY_NOTICE_URL;
      env.NODE_ENV = "production";
      assert.deepEqual(intakeOpen(), { open: false, preview: false });
      env.NODE_ENV = "development";
      assert.deepEqual(intakeOpen(), { open: true, preview: true }, "local preview only");
      env.PRIVACY_NOTICE_URL = "http://insecure.example.test/privacy";
      assert.equal(privacyNoticeUrl(), null, "only https or a page on this site");
      env.PRIVACY_NOTICE_URL = "//evil.example.test/privacy";
      assert.equal(privacyNoticeUrl(), null);
      env.PRIVACY_NOTICE_URL = "/privacy";
      assert.equal(privacyNoticeUrl(), "/privacy");
      env.PRIVACY_NOTICE_URL = "https://xellotuition.com/privacy";
      env.NODE_ENV = "production";
      assert.deepEqual(intakeOpen(), { open: true, preview: false });
    } finally {
      if (saved.url === undefined) delete env.PRIVACY_NOTICE_URL;
      else env.PRIVACY_NOTICE_URL = saved.url;
      env.NODE_ENV = saved.env;
    }
  });
});
