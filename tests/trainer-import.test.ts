/**
 * Trainer sign-up sheet reader. All people below are fictional; the subject and
 * class phrases are the generic wordings seen in real form answers.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mapClasses, mapSubjects, normalizeIndianPhone, parseDelimited, readTrainerSheet, toImportPayload } from "../src/lib/trainer-import";
import { formatDays, readDays } from "../src/lib/trainer-profile";

const KG = "KG (LKG / UKG)", P = "Primary (1st–5th)", M = "Middle (6th–8th)", HS = "High School (9th–10th)", P1 = "Plus One (+1 / 11th)", P2 = "Plus Two (+2 / 12th)";
const row = (cells: string[]) => cells.join("\t");
const FAKE_ACCOUNT = "000011112222";
const FAKE_IFSC = "TEST0000001";

const SHEET = [
  row(["01/10/2026 10:00:00", "Asha Test", "Wandoor", "9000000001", "asha.test@example.com", "MSc", "Mathematics", "CBSE", "8 -plus 2", "Laptop", "Monday, Tuesday, Wednesday, Thursday, Friday", "After 5 pm", `Account number: ${FAKE_ACCOUNT} IFSC ${FAKE_IFSC}`, "9000000001", "", ""]),
  row(["01/10/2026 10:05:00", "Bina Test", "Kozhikode", "+919000000002", "Bina.Test@Example. Com", "BEd", "Physics and chemistry", "CBSE, ICSE", "HS, HSST", "Mobile Phone", "Saturday, Sunday", '"Mng 10 to 1\nEvening 7 to 9"', `"Beneficiary: BINA\tA/C ${FAKE_ACCOUNT}"`, "9000000002/ 9000000099"]),
  row(["01/10/2026 10:10:00", "Chitra Test", "Calicut", "9000000003", "chitra", "BA", "English", "CBSE", "1 to 10", "Tab", "Monday", "6 pm", FAKE_IFSC, "9000000003"]),
  row(["01/10/2026 10:15:00", "Devi Test", "Kannur", "12345", "devi.test@gamil.com", "MA", "Hindi, Maths, Social science & Chemistry", "Kerala State English Medium", "UP,HS,HSS", "Laptop, Mobile Phone", "Monday, Wednesday", "7:30 to 8:30", "", "95,395,010,199,656,900,000"]),
  row(["01/10/2026 10:20:00", "Asha Duplicate", "Wandoor", "9000000004", "asha.test@example.com", "MSc", "Mathematics", "CBSE", "10", "Laptop", "Friday", "6", "", ""]),
].join("\n");

describe("trainer sheet reader", () => {
  test("bank details are never read: they appear in no candidate and no payload", () => {
    const { candidates } = readTrainerSheet(SHEET);
    const sent = JSON.stringify(candidates.map(toImportPayload));
    const all = JSON.stringify(candidates);
    for (const secret of [FAKE_ACCOUNT, FAKE_IFSC, "Beneficiary"]) {
      assert.ok(!sent.includes(secret), `payload contains ${secret}`);
      assert.ok(!all.includes(secret), `candidate contains ${secret}`);
    }
  });

  test("quoted cells keep their tabs and line breaks, so columns stay aligned", () => {
    const rows = parseDelimited(SHEET);
    assert.equal(rows.length, 5);
    assert.equal(rows[1][11], "Mng 10 to 1\nEvening 7 to 9");
    assert.equal(rows[1][13], "9000000002/ 9000000099", "WhatsApp is still the 14th column after a quoted tab");
  });

  test("phones get +91, emails are tidied, problems and warnings are explained", () => {
    const { candidates, error } = readTrainerSheet(SHEET);
    assert.equal(error, null);
    const [asha, bina, chitra, devi, dup] = candidates;
    assert.equal(asha.phone, "+91 90000 00001");
    assert.deepEqual(asha.problems, []);
    assert.equal(asha.whatsapp, null, "same as phone");
    assert.equal(bina.phone, "+91 90000 00002");
    assert.equal(bina.email, "bina.test@example.com");
    assert.ok(bina.warnings.some((w) => /Spaces removed/.test(w)));
    assert.equal(bina.whatsapp, null, "one of the WhatsApp numbers is the phone");
    assert.match(bina.notes, /WhatsApp as written: 9000000002\/ 9000000099/);
    assert.equal(bina.availableTimes, "Mng 10 to 1 · Evening 7 to 9");
    assert.ok(chitra.problems.some((p) => /incomplete/.test(p)), "email 'chitra' is incomplete");
    assert.ok(devi.problems.some((p) => /could not be read/.test(p)), "phone 12345 refused");
    assert.ok(devi.warnings.some((w) => /gamil\.com.*gmail\.com/.test(w)));
    assert.ok(devi.warnings.some((w) => /WhatsApp number .* could not be read/.test(w)));
    assert.ok(dup.problems.some((p) => /Same email as row 1/.test(p)));
  });

  test("header rows are skipped and unrelated pastes are refused", () => {
    const header = row(["Timestamp", "Name", "Place", "Phone", "Email address", "Qualification", "Subjects", "Syllabus", "Classes", "Device", "Days", "Time", "Bank details", "WhatsApp"]);
    const withHeader = readTrainerSheet(`${header}\n${SHEET}`);
    assert.equal(withHeader.skippedHeader, true);
    assert.equal(withHeader.candidates.length, 5);
    assert.match(readTrainerSheet("hello\tworld\nfoo\tbar").error ?? "", /don't look like the trainer sign-up sheet/);
    assert.match(readTrainerSheet("   ").error ?? "", /Paste at least one row/);
  });

  test("available days", () => {
    assert.deepEqual(readDays("Monday, Tuesday, Wednesday, Thursday, Friday"), ["Mon", "Tue", "Wed", "Thu", "Fri"]);
    assert.equal(formatDays(["Mon", "Tue", "Wed", "Thu", "Fri"]), "Mon–Fri");
    assert.equal(formatDays(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]), "Every day");
    assert.equal(formatDays(["Mon", "Wed", "Sun"]), "Mon, Wed, Sun");
  });

  test("phone formats", () => {
    assert.equal(normalizeIndianPhone("9876 543 210"), "+91 98765 43210");
    assert.equal(normalizeIndianPhone("09876543210"), "+91 98765 43210");
    assert.equal(normalizeIndianPhone("+971 50 123 4567"), "+971 50 123 4567");
    assert.equal(normalizeIndianPhone("5061943670"), null, "Indian mobiles start with 6–9");
  });
});

describe("subject wording from real sign-up answers", () => {
  const cases: [string, string[]][] = [
    ["Mathematics ", ["Mathematics"]],
    ["Maths", ["Mathematics"]],
    ["Hindi, Maths, Social science & Chemistry ", ["Hindi", "Mathematics", "Social Science", "Chemistry"]],
    ["Social science, English", ["Social Science", "English"]],
    ["Biology (Botony&Zoology) Hindi, Chemistry", ["Biology", "Hindi", "Chemistry"]],
    ["Teach both Biology and Chemistry for 9&10th and General Science from grade 6-8 classes", ["Biology", "Chemistry", "Science"]],
    ["Physics and chemistry ", ["Physics", "Chemistry"]],
    ["All subject ", ["All Subjects"]],
    ["Arabic & Social science ", ["Arabic", "Social Science"]],
    ["Physics , Social Science ", ["Physics", "Social Science"]],
    ["Zoology, Biology ", ["Biology"]],
    ["Science ", ["Science"]],
    ["Primary students all subject except Hindi ", ["All Subjects"]],
    ["Maths,Physics,Biology,Computer Science,Coding", ["Mathematics", "Physics", "Biology", "Computer Science"]],
    ["Science and social science", ["Science", "Social Science"]],
    ["French, science, english, hindi, sanskrit ", ["French", "Science", "English", "Hindi", "Sanskrit"]],
    ["Socialscience and malayalam ", ["Social Science", "Malayalam"]],
    ["Social science ( also all subjects)", ["Social Science", "All Subjects"]],
    ["Social science,Basic science ", ["Social Science", "Science"]],
    ["Chemistry(grade:8-10),General science:(grade5-7)", ["Chemistry", "Science"]],
    ["English,E.v.s, Hindi, malayalam ", ["English", "EVS", "Hindi", "Malayalam"]],
    ["Computer application ", ["Computer Applications"]],
    ["Biology, science, Evs, English", ["Biology", "Science", "EVS", "English"]],
    ["English, science, arabic, maths", ["English", "Science", "Arabic", "Mathematics"]],
    ["Kannada", ["Kannada"]],
  ];
  for (const [text, expected] of cases) {
    test(JSON.stringify(text.trim()), () => assert.deepEqual(mapSubjects(text).subjects, expected));
  }
});

describe("class wording from real sign-up answers", () => {
  const cases: [string, string[]][] = [
    ["8 -plus 2", [M, HS, P1, P2]],
    ["+1 +2 degree", [P1, P2, "Degree / College"]],
    ["8,9,10, +1, +2", [M, HS, P1, P2]],
    ["Class 8 - Class 12", [M, HS, P1, P2]],
    ["9 & 10", [HS]],
    ["HS, HSST", [M, HS, P1, P2]],
    ["1 to 10", [P, M, HS]],
    ["6 to 10", [M, HS]],
    ["9,10,11 and 12", [HS, P1, P2]],
    ["8,9&10", [M, HS]],
    ["10-12", [HS, P1, P2]],
    ["7 to +2", [M, HS, P1, P2]],
    ["+1&+2", [P1, P2]],
    ["5 to +2", [P, M, HS, P1, P2]],
    ["7 to plus 2", [M, HS, P1, P2]],
    ["Till class 10", [P, M, HS]],
    ["High school and higher secondary", [M, HS, P1, P2]],
    ["Class 5 to 12", [P, M, HS, P1, P2]],
    ["1 to 10 std", [P, M, HS]],
    ["Kg to 10th", [KG, P, M, HS]],
    ["Grade 1-7 all subjects and High school Physics Social and Biology", [P, M, HS]],
    ["10", [HS]],
    ["UP,HS,HSS", [P, M, HS, P1, P2]],
    ["4-7", [P, M]],
    ["Class 6,7, 8, Class 11", [M, P1]],
    ["Up, hs, hss", [P, M, HS, P1, P2]],
    ["Highschool and higher secondary", [M, HS, P1, P2]],
    ["1 to 9", [P, M, HS]],
    ["1-12", [P, M, HS, P1, P2]],
    ["KG to 8", [KG, P, M]],
    ["Upto class 12", [P, M, HS, P1, P2]],
    ["1 - 12 th grades", [P, M, HS, P1, P2]],
    ["2nd to 12th", [P, M, HS, P1, P2]],
    ["Upto 3", [P]],
    ["Kg to 5th", [KG, P]],
    ["1 to plus two", [P, M, HS, P1, P2]],
    ["5th to +2", [P, M, HS, P1, P2]],
  ];
  for (const [text, expected] of cases) {
    test(JSON.stringify(text), () => assert.deepEqual(mapClasses(text).grades, expected));
  }
});
