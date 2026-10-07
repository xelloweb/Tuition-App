/**
 * Reads rows copied from the trainer sign-up form's Google Sheet.
 *
 * Runs in the browser before anything is sent: the bank-details column (13th)
 * is never read, so bank details are never uploaded or stored.
 * Columns, in form order: Timestamp, Name, Place, Phone, Email, Qualification,
 * Subjects, Syllabus, Classes, Device, Days, Time, [Bank details], WhatsApp.
 */
import { TEACHER_PRESET_GRADES } from "./grades";
import { checkInternationalPhone, isValidEmail, phonesMatch } from "./validation";
import { readDays } from "./trainer-profile";

const COL = { submittedAt: 0, name: 1, place: 2, phone: 3, email: 4, qualification: 5, subjects: 6, syllabus: 7, classes: 8, devices: 9, days: 10, times: 11, whatsapp: 13 } as const;

export interface TrainerCandidate {
  /** Position among the pasted data rows, starting at 1 (header excluded). */
  line: number;
  name: string;
  email: string;
  phone: string;
  subjects: string[];
  grades: string[];
  location: string | null;
  qualification: string | null;
  syllabus: string | null;
  devices: string | null;
  availableDays: string[];
  availableTimes: string | null;
  whatsapp: string | null;
  notes: string;
  /** Blocking: the row is not sent. */
  problems: string[];
  /** Informational: the row is still imported. */
  warnings: string[];
}

export interface SheetReadResult {
  candidates: TrainerCandidate[];
  skippedHeader: boolean;
  error: string | null;
}

/** Tab- or comma-separated text with Google Sheets quoting (cells may contain tabs and line breaks). */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/\r\n?/g, "\n");
  const delimiter = src.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let atStart = true;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && atStart) {
      inQuotes = true;
      atStart = false;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
      atStart = true;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      atStart = true;
    } else {
      field += ch;
      atStart = false;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** 10-digit Indian mobiles get +91; numbers already in +country form are validated as they are. */
export function normalizeIndianPhone(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  let national: string | null = null;
  if (text.startsWith("+")) {
    if (digits.startsWith("91") && digits.length === 12) national = digits.slice(2);
    else {
      const check = checkInternationalPhone(text);
      return check.ok ? check.display : null;
    }
  } else if (digits.length === 10) national = digits;
  else if (digits.length === 11 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 12 && digits.startsWith("91")) national = digits.slice(2);
  if (!national || !/^[6-9]\d{9}$/.test(national)) return null;
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}

export function normalizeEmail(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/^mailto:/i, "").replace(/[.,;]+$/, "").toLowerCase();
}

const TYPO_DOMAINS: Record<string, string> = {
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "hotmal.com": "hotmail.com",
  "outlok.com": "outlook.com",
};

const SUBJECT_PATTERNS: [RegExp, string][] = [
  [/\bcomputer\s*applications?\b/g, "Computer Applications"],
  [/\bcomputer\s*science\b|\bcomputers?\b|\bcoding\b|\bprogramming\b/g, "Computer Science"],
  [/\bsocial\s*(science|studies)\b|\bsocialscience\b|\bsocial\b/g, "Social Science"],
  [/\b(general|basic)\s*science\b/g, "Science"],
  [/\bmath(s|ematics)?\b/g, "Mathematics"],
  [/\bphysics\b/g, "Physics"],
  [/\bchemistry\b/g, "Chemistry"],
  [/\bbiology\b|\bzoology\b|\bbotany\b|\bbotony\b/g, "Biology"],
  [/\benglish\b/g, "English"],
  [/\bhindi\b/g, "Hindi"],
  [/\bmalayalam\b/g, "Malayalam"],
  [/\barabic\b/g, "Arabic"],
  [/\bfrench\b/g, "French"],
  [/\bsanskrit\b/g, "Sanskrit"],
  [/\btamil\b/g, "Tamil"],
  [/\burdu\b/g, "Urdu"],
  [/\baccountancy\b|\baccounts\b/g, "Accountancy"],
  [/\beconomics\b/g, "Economics"],
  [/\bbusiness\s*studies\b/g, "Business Studies"],
  [/\bhistory\b/g, "History"],
  [/\bgeography\b/g, "Geography"],
  [/\bstatistics\b/g, "Statistics"],
  [/\be\.?\s?v\.?\s?s\.?(?![a-z])|\benvironmental\s*studies\b/g, "EVS"],
  [/\bscience\b/g, "Science"],
  [/\ball\s*subjects?\b/g, "All Subjects"],
];

const STOP_WORDS = new Set(
  "teach teaching both for from grade grades class classes std standard students student primary upper lower high school higher secondary also only level levels all subject subjects and the with any of in to up upto till kg lp hs hss ug pg medium syllabus cbse icse state kerala board boards i can etc other others mainly mostly including".split(" ")
);

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " · ").replace(/[ \t]+/g, " ").trim();

/** Free-text subjects → standard subject names, in the order written. */
export function mapSubjects(raw: string): { subjects: string[]; recognised: boolean } {
  let work = ` ${raw.toLowerCase().replace(/\bexcept\b[^,;]*/g, " ")} `;
  const found: { name: string; at: number }[] = [];
  for (const [re, name] of SUBJECT_PATTERNS) {
    work = work.replace(re, (m: string, ...args: unknown[]) => {
      const at = args[args.length - 2] as number;
      if (!found.some((f) => f.name === name)) found.push({ name, at });
      return " ".repeat(m.length);
    });
  }
  const leftovers: string[] = [];
  for (const part of work.split(/[,;/&+()]|\band\b|\bwith\b/)) {
    if (/\d/.test(part)) continue;
    const words = part.replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    const text = words.join(" ");
    if (!words.length || words.length > 3 || text.length < 3 || text.length > 30 || words.some((w) => STOP_WORDS.has(w))) continue;
    leftovers.push(titleCase(text));
  }
  const subjects = [...found.sort((a, b) => a.at - b.at).map((f) => f.name), ...leftovers.filter((l) => !found.some((f) => f.name === l))];
  if (subjects.length) return { subjects, recognised: found.length > 0 };
  const fallback = oneLine(raw);
  return { subjects: fallback && fallback.length <= 60 ? [fallback] : [], recognised: false };
}

const GRADE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: TEACHER_PRESET_GRADES[0], min: 0, max: 0 },
  { label: TEACHER_PRESET_GRADES[1], min: 1, max: 5 },
  { label: TEACHER_PRESET_GRADES[2], min: 6, max: 8 },
  { label: TEACHER_PRESET_GRADES[3], min: 9, max: 10 },
  { label: TEACHER_PRESET_GRADES[4], min: 11, max: 11 },
  { label: TEACHER_PRESET_GRADES[5], min: 12, max: 12 },
];

/**
 * Free-text classes ("8 -plus 2", "HS, HSST", "Kg to 10th", "UP,HS,HSS") → the
 * app's class bands. Kerala levels: LP 1–4, UP 5–7, HS 8–10, HSS 11–12.
 */
export function mapClasses(raw: string): { grades: string[]; recognised: boolean } {
  let t = ` ${raw.toLowerCase().replace(/[–—]/g, "-")} `;
  const extra: string[] = [];
  if (/\bneet\b|\bentrance\b|\bkeam\b/.test(t)) extra.push(TEACHER_PRESET_GRADES[6]);
  if (/\bjee\b/.test(t)) extra.push(TEACHER_PRESET_GRADES[7]);
  if (/\bdegree\b|\bcollege\b|\bug\b|\bpg\b/.test(t)) extra.push("Degree / College");
  t = t
    .replace(/\bplus\s*(one|1)\b|\+\s*1(?!\d)/g, " 11 ")
    .replace(/\bplus\s*(two|2)\b|\+\s*2(?!\d)/g, " 12 ")
    .replace(/\bhigher\s*secondary\b|\bhsst\b|\bhss\b|\bhse\b|\bvhse\b/g, " 11-12 ")
    .replace(/\bhigh\s*school\b|\bhighschool\b|\bhs\b/g, " 8-10 ")
    .replace(/\b(lkg|ukg|kg|kindergarten|montessori)\b|\bpre-?\s*primary\b/g, " 0 ")
    .replace(/\bup\s*to\b|\bupto\b|\btill\b|\buntil\b/g, " upto ")
    .replace(/\blower\s*primary\b|\blp\b/g, " 1-4 ")
    .replace(/\bupper\s*primary\b|\bup\b/g, " 5-7 ")
    .replace(/\bprimary\b/g, " 1-5 ")
    .replace(/(\d+)\s*(st|nd|rd|th)\b/g, "$1")
    .replace(/\b(class|classes|grade|grades|std|standard|standards)\b/g, " ");
  const levels = new Set<number>();
  const add = (a: number, b: number) => {
    for (let n = Math.max(0, Math.min(a, b)); n <= Math.min(12, Math.max(a, b)); n++) levels.add(n);
  };
  t = t.replace(/upto\s*(\d{1,2})/g, (_m, b: string) => {
    add(1, Number(b));
    return " ";
  });
  t = t.replace(/(\d{1,2})\s*(?:-|to)\s*(\d{1,2})/g, (_m, a: string, b: string) => {
    add(Number(a), Number(b));
    return " ";
  });
  for (const m of t.matchAll(/\b(\d{1,2})\b/g)) {
    const n = Number(m[1]);
    if (n <= 12) levels.add(n);
  }
  const grades = [...GRADE_BUCKETS.filter((b) => [...levels].some((n) => n >= b.min && n <= b.max)).map((b) => b.label), ...extra];
  if (grades.length) return { grades, recognised: true };
  const fallback = oneLine(raw);
  return { grades: fallback && fallback.length <= 60 ? [fallback] : [], recognised: false };
}

function looksLikeHeader(row: string[]): boolean {
  const joined = row.join(" ").toLowerCase();
  return !(row[COL.email] ?? "").includes("@") && /\bname\b/.test(joined) && /e-?mail/.test(joined);
}

export function readTrainerSheet(text: string): SheetReadResult {
  const rows = parseDelimited(text);
  if (rows.length === 0) return { candidates: [], skippedHeader: false, error: "Paste at least one row from the sheet." };
  const skippedHeader = looksLikeHeader(rows[0]);
  const data = skippedHeader ? rows.slice(1) : rows;
  if (data.length === 0) return { candidates: [], skippedHeader, error: "Only a header row was pasted. Copy the trainer rows too." };
  const plausible = data.filter((r) => (r[COL.email] ?? "").includes("@") || (r[COL.phone] ?? "").replace(/\D/g, "").length >= 8).length;
  if (plausible < Math.ceil(data.length / 2)) {
    return {
      candidates: [],
      skippedHeader,
      error: "These rows don't look like the trainer sign-up sheet. Copy whole rows, from the Timestamp column to the WhatsApp column, and paste again.",
    };
  }

  const seenEmail = new Map<string, TrainerCandidate>();
  const candidates: TrainerCandidate[] = data.map((row, i) => {
    const cell = (c: number) => (row[c] ?? "").trim();
    const problems: string[] = [];
    const warnings: string[] = [];
    const name = oneLine(cell(COL.name)).replace(/\s+/g, " ");
    if (!name) problems.push("Name is missing.");

    const phoneRaw = oneLine(cell(COL.phone));
    const phone = normalizeIndianPhone(phoneRaw) ?? "";
    if (!phoneRaw) problems.push("Phone number is missing.");
    else if (!phone) problems.push(`Phone number “${phoneRaw}” could not be read. Use a 10-digit Indian mobile number or +country code.`);

    const emailRaw = cell(COL.email);
    const email = normalizeEmail(emailRaw);
    if (!email) problems.push("Email address is missing.");
    else if (!isValidEmail(email)) problems.push(`Email “${emailRaw}” is incomplete.`);
    else {
      const domain = email.split("@")[1];
      if (TYPO_DOMAINS[domain]) warnings.push(`Email ends in @${domain}. Did they mean @${TYPO_DOMAINS[domain]}? It is saved as written; fix it later with Edit if needed.`);
      if (/\s/.test(emailRaw.trim())) warnings.push(`Spaces removed from the email: ${email}.`);
    }

    const subjectsText = oneLine(cell(COL.subjects));
    const { subjects, recognised: subjectsRecognised } = mapSubjects(subjectsText);
    if (!subjectsText) problems.push("No subjects given.");
    else if (!subjects.length) problems.push("Subjects could not be read; shorten them in the sheet.");
    else if (!subjectsRecognised) warnings.push("Subjects kept as written; check them after importing.");

    const classesText = oneLine(cell(COL.classes));
    const { grades, recognised: classesRecognised } = mapClasses(classesText);
    if (!classesText) problems.push("No classes given.");
    else if (!grades.length) problems.push("Classes could not be read; shorten them in the sheet.");
    else if (!classesRecognised) warnings.push("Classes kept as written; check them after importing.");

    const whatsappText = oneLine(cell(COL.whatsapp));
    const numbers = [...new Set(whatsappText.split(/[/,;|&]|\bor\b/i).map((p) => normalizeIndianPhone(p)).filter((n): n is string => Boolean(n)))];
    let whatsapp: string | null = null;
    let keepWhatsappText = false;
    if (whatsappText && numbers.length === 0) {
      warnings.push(`WhatsApp number “${whatsappText}” could not be read, so it was left out.`);
      keepWhatsappText = true;
    } else if (numbers.length) {
      const other = numbers.filter((n) => !phonesMatch(n, phone));
      whatsapp = numbers.length === other.length ? other[0] : null;
      keepWhatsappText = numbers.length > 1;
    }

    const submittedAt = cell(COL.submittedAt);
    const noteParts = [`From the trainer sign-up form${submittedAt ? ` (${oneLine(submittedAt)})` : ""}.`];
    if (subjectsText && subjects.join(", ").toLowerCase() !== subjectsText.toLowerCase()) noteParts.push(`Subjects as written: ${subjectsText}.`);
    if (classesText) noteParts.push(`Classes as written: ${classesText}.`);
    if (keepWhatsappText) noteParts.push(`WhatsApp as written: ${whatsappText}.`);

    const candidate: TrainerCandidate = {
      line: i + 1,
      name,
      email,
      phone,
      subjects,
      grades,
      location: oneLine(cell(COL.place)).slice(0, 100) || null,
      qualification: oneLine(cell(COL.qualification)).slice(0, 200) || null,
      syllabus: oneLine(cell(COL.syllabus)).slice(0, 200) || null,
      devices: oneLine(cell(COL.devices)).slice(0, 100) || null,
      availableDays: readDays(cell(COL.days)),
      availableTimes: oneLine(cell(COL.times)).slice(0, 200) || null,
      whatsapp,
      notes: noteParts.join(" ").slice(0, 1000),
      problems,
      warnings,
    };

    if (email && isValidEmail(email)) {
      const first = seenEmail.get(email);
      if (first) problems.push(`Same email as row ${first.line} (${first.name}); only the first is added.`);
      else seenEmail.set(email, candidate);
    }
    return candidate;
  });

  // Same phone twice in one paste: keep the first.
  candidates.forEach((c, i) => {
    if (!c.phone) return;
    const first = candidates.slice(0, i).find((o) => o.phone && phonesMatch(o.phone, c.phone));
    if (first && !c.problems.some((p) => p.startsWith("Same email"))) c.problems.push(`Same phone number as row ${first.line} (${first.name}); only the first is added.`);
  });

  return { candidates, skippedHeader, error: null };
}

/** Exactly what is sent to the server for one trainer (no bank details exist here). */
export function toImportPayload(c: TrainerCandidate) {
  return {
    name: c.name,
    email: c.email,
    phone: c.phone,
    subjects: c.subjects,
    grades: c.grades,
    location: c.location,
    qualification: c.qualification,
    syllabus: c.syllabus,
    devices: c.devices,
    availableDays: c.availableDays,
    availableTimes: c.availableTimes,
    whatsapp: c.whatsapp,
    notes: c.notes,
  };
}
