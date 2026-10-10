/**
 * Parent admission form (public, /admission/apply): field rules shared by the
 * form (instant feedback) and the API (authoritative checks). Isomorphic: no
 * server-only imports. Times are India Standard Time only; the parent's country
 * never changes how times are entered or shown.
 */
import { ALL_GRADES } from "./grades";
import { BOARD_OPTIONS, COUNTRIES, COUNTRY_VALUES, MEDIUM_OPTIONS, PHONE_RULES, findCountry } from "./constants";
import { checkInternationalPhone, isValidEmail, phoneKey } from "./validation";
import { WEEKDAYS, cleanDays, dayList, sortDays, weekdayName } from "./preferred-days";

export { WEEKDAYS, dayList, weekdayName };

export const RELATIONSHIPS = ["Father", "Mother", "Guardian", "Grandparent", "Other"] as const;
export const TEACHING_LANGUAGES = [...MEDIUM_OPTIONS, "Arabic"];

export const INTAKE_LIMITS = {
  subjects: 12,
  preferences: 20,
  /** How far back a start date may go (a student who already studies with Xello), in days. */
  startDatePastDays: 3650,
  shortText: 120,
  textArea: 1000,
  /** Earliest and latest class time parents can suggest (IST). */
  earliest: "06:00",
  latest: "23:00",
  maxPreferenceMinutes: 240,
};

export const INTAKE_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "AWAITING_INFO", label: "Awaiting information" },
  { value: "READY", label: "Ready for admission" },
  { value: "CONVERTED", label: "Converted" },
  { value: "CLOSED", label: "Closed" },
] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number]["value"];
export const statusLabel = (value: string) => INTAKE_STATUSES.find((s) => s.value === value)?.label ?? value;
/** Staff can set these by hand; Converted is set only by a confirmed admission. */
export const MANUAL_STATUSES: IntakeStatus[] = ["NEW", "CONTACTED", "AWAITING_INFO", "READY", "CLOSED"];

export interface PreferenceInput {
  subjectId: string;
  weekday: number;
  start: string;
  end: string;
}

/** Everything the parent typed (strings as entered). */
export interface IntakeInput {
  studentName: string;
  grade: string;
  board: string;
  schoolName: string;
  medium: string;
  subjectIds: string[];
  guardianName: string;
  relationship: string;
  whatsappNumber: string;
  altPhone: string;
  email: string;
  country: string;
  city: string;
  helpAreas: string;
  teachingLanguage: string;
  startDate: string;
  notes: string;
  /** Days that usually suit the child, 0 = Sunday … 6 = Saturday (optional; the form asks for days only). */
  preferredDays: number[];
  /** Day and time per subject, sent by the earlier version of the form; still accepted and shown. */
  preferences: PreferenceInput[];
  consent: boolean;
}

/** Validated, normalised values (what is stored). */
export interface IntakeData {
  studentName: string;
  grade: string;
  board: string;
  schoolName: string | null;
  medium: string | null;
  subjectIds: string[];
  guardianName: string;
  relationship: string;
  whatsappNumber: string;
  altPhone: string | null;
  email: string | null;
  country: string;
  city: string | null;
  helpAreas: string | null;
  teachingLanguage: string | null;
  startDate: string | null;
  notes: string | null;
  preferredDays: number[];
  preferences: PreferenceInput[];
  consent: true;
}

export const emptyIntake = (): IntakeInput => ({
  studentName: "",
  grade: "",
  board: "",
  schoolName: "",
  medium: "",
  subjectIds: [],
  guardianName: "",
  relationship: "",
  whatsappNumber: "",
  altPhone: "",
  email: "",
  country: "",
  city: "",
  helpAreas: "",
  teachingLanguage: "",
  startDate: "",
  notes: "",
  preferredDays: [],
  preferences: [],
  consent: false,
});

/**
 * Turns what a parent types into "+<country code><number>": accepts "+971 50…",
 * "00971 50…", a local "050…" (country chosen above) or an Indian "98470 12345".
 */
export function normalizeParentPhone(raw: string, country: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let value = trimmed.replace(/[^\d+]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (value.startsWith("+")) return `+${value.slice(1).replace(/\D/g, "")}`;
  const dial = (findCountry(country)?.dialCode ?? "+91").slice(1);
  const local = value.replace(/^0+/, "");
  const rule = PHONE_RULES[dial];
  const fits = (n: number) => (rule ? n >= rule.min && n <= rule.max : n >= 8);
  // A number that already has the right length is local (e.g. an Indian mobile starting 91…);
  // otherwise it may include the country code without "+", e.g. 971501234567.
  if (!fits(local.length) && local.startsWith(dial) && fits(local.length - dial.length)) return `+${local}`;
  return `+${dial}${local}`;
}

/** "+971501234567" → "+971 501234567"; unknown codes stay as typed. */
export function formatPhone(normalized: string): string {
  const digits = normalized.replace(/\D/g, "");
  const code = Object.keys(PHONE_RULES)
    .sort((a, b) => b.length - a.length)
    .find((c) => digits.startsWith(c));
  if (!code) return normalized;
  const rest = digits.slice(code.length);
  return code === "91" && rest.length === 10 ? `+91 ${rest.slice(0, 5)} ${rest.slice(5)}` : `+${code} ${rest}`;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function toMinutes(value: string): number | null {
  const m = TIME.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Removes control characters (keeps line breaks in long answers). */
function clean(value: unknown, multiline = false): string {
  if (typeof value !== "string") return "";
  const stripped = multiline ? value.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "") : value.replace(/[\u0000-\u001F\u007F]/g, " ");
  return stripped.trim();
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The start dates a parent may choose: up to 10 years back (a student who
 * already studies with Xello gives the date they started) and a year ahead.
 */
export function startDateBounds(todayIst: string) {
  return { min: addDays(todayIst, -INTAKE_LIMITS.startDatePastDays), max: addDays(todayIst, 365) };
}

export const GRADE_VALUES = ALL_GRADES.map((g) => g.value);

/**
 * Validates a submission. `subjectIds` is the list of subjects the school
 * offers (null on the client, where the form only offers those anyway).
 * `todayIst` is today's date in India (YYYY-MM-DD).
 */
export function validateIntake(
  raw: unknown,
  { subjectIds, todayIst }: { subjectIds: Set<string> | null; todayIst: string }
): { data: IntakeData | null; errors: Record<string, string> } {
  const body = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const add = (field: string, message: string) => {
    if (!errors[field]) errors[field] = message;
  };
  const text = (field: string, label: string, { required = false, max = INTAKE_LIMITS.shortText, multiline = false } = {}) => {
    const value = clean(body[field], multiline);
    if (!value) {
      if (required) add(field, `Enter the ${label}.`);
      return null;
    }
    if (value.length > max) add(field, `Keep the ${label} to ${max} characters or fewer.`);
    return value.slice(0, max);
  };
  const choice = (field: string, label: string, allowed: readonly string[], required: boolean) => {
    const value = clean(body[field]);
    if (!value) {
      if (required) add(field, `Choose the ${label}.`);
      return null;
    }
    if (!allowed.includes(value)) {
      add(field, `Choose the ${label} from the list.`);
      return null;
    }
    return value;
  };

  const studentName = text("studentName", "student's full name", { required: true });
  const grade = choice("grade", "class / grade", GRADE_VALUES, true);
  const board = choice("board", "board / curriculum", BOARD_OPTIONS, true);
  const schoolName = text("schoolName", "school name", { max: 150 });
  const medium = choice("medium", "medium of instruction", MEDIUM_OPTIONS, false);

  const rawSubjects = Array.isArray(body.subjectIds) ? body.subjectIds : [];
  const chosen = [...new Set(rawSubjects.filter((s): s is string => typeof s === "string" && s.length > 0 && s.length <= 64))];
  if (chosen.length === 0) add("subjectIds", "Choose at least one subject.");
  else if (chosen.length > INTAKE_LIMITS.subjects) add("subjectIds", `Choose up to ${INTAKE_LIMITS.subjects} subjects.`);
  else if (subjectIds && chosen.some((id) => !subjectIds.has(id))) add("subjectIds", "One of the chosen subjects is no longer offered. Refresh the page and choose again.");

  const guardianName = text("guardianName", "parent or guardian's full name", { required: true });
  const relationship = choice("relationship", "relationship to the student", RELATIONSHIPS, true);
  const country = choice("country", "country where you live", COUNTRY_VALUES, true);

  const phone = (field: string, label: string, required: boolean) => {
    const value = clean(body[field]);
    if (!value) {
      if (required) add(field, `Enter the ${label} with the country code.`);
      return null;
    }
    if (value.length > 30) {
      add(field, `Enter a valid ${label}.`);
      return null;
    }
    const normalized = normalizeParentPhone(value, country ?? "India");
    const check = checkInternationalPhone(normalized);
    if (!check.ok) {
      add(field, check.error ? `${check.error}` : `Enter a valid ${label}.`);
      return null;
    }
    return formatPhone(normalized);
  };
  const whatsappNumber = phone("whatsappNumber", "WhatsApp number", true);
  const altPhone = phone("altPhone", "alternative number", false);
  if (whatsappNumber && altPhone && phoneKey(whatsappNumber) === phoneKey(altPhone)) {
    add("altPhone", "This is the same as the WhatsApp number. Leave it empty or enter a different number.");
  }

  let email: string | null = clean(body.email).toLowerCase() || null;
  if (email && (email.length > 254 || !isValidEmail(email))) {
    add("email", "Enter a valid email address, e.g. name@example.com, or leave it empty.");
    email = null;
  }
  const city = text("city", "city", { max: 80 });

  const helpAreas = text("helpAreas", "areas where your child needs help", { max: INTAKE_LIMITS.textArea, multiline: true });
  const teachingLanguage = choice("teachingLanguage", "teaching language", TEACHING_LANGUAGES, false);
  let startDate: string | null = clean(body.startDate) || null;
  if (startDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(new Date(`${startDate}T00:00:00Z`).getTime())) {
      add("startDate", "Enter a valid date.");
      startDate = null;
    } else if (startDate < startDateBounds(todayIst).min) {
      add("startDate", "Choose a date within the last 10 years.");
    } else if (startDate > startDateBounds(todayIst).max) {
      add("startDate", "Choose a date within the next year.");
    }
  }
  const notes = text("notes", "additional notes", { max: INTAKE_LIMITS.textArea, multiline: true });

  const rawPrefs = Array.isArray(body.preferences) ? body.preferences : [];
  if (rawPrefs.length > INTAKE_LIMITS.preferences) add("preferences", `Add up to ${INTAKE_LIMITS.preferences} preferred times.`);
  const earliest = toMinutes(INTAKE_LIMITS.earliest)!;
  const latest = toMinutes(INTAKE_LIMITS.latest)!;
  const preferences: PreferenceInput[] = [];
  rawPrefs.slice(0, INTAKE_LIMITS.preferences).forEach((item, i) => {
    const p = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const subjectId = typeof p.subjectId === "string" ? p.subjectId : "";
    const weekday = typeof p.weekday === "number" ? p.weekday : Number(p.weekday);
    const start = clean(p.start);
    const end = clean(p.end);
    if (!subjectId || !chosen.includes(subjectId)) add(`preferences.${i}.subjectId`, "Choose one of the subjects selected above.");
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) add(`preferences.${i}.weekday`, "Choose a day.");
    const s = toMinutes(start);
    const e = toMinutes(end);
    if (s === null) add(`preferences.${i}.start`, "Enter a start time (IST).");
    if (e === null) add(`preferences.${i}.end`, "Enter an end time (IST).");
    if (s !== null && e !== null) {
      if (e <= s) add(`preferences.${i}.end`, "The end time must be after the start time.");
      else if (e - s > INTAKE_LIMITS.maxPreferenceMinutes) add(`preferences.${i}.end`, "Keep each preferred time to 4 hours or less.");
      if (s < earliest || e > latest) add(`preferences.${i}.start`, `Choose times between ${INTAKE_LIMITS.earliest} and ${INTAKE_LIMITS.latest} IST.`);
    }
    preferences.push({ subjectId, weekday, start, end });
  });

  let preferredDays = cleanDays(body.preferredDays);
  if (preferredDays === null) {
    add("preferredDays", "Choose days from Monday to Sunday.");
    preferredDays = [];
  } else if (preferredDays.length === 0 && preferences.length > 0) {
    // A form opened before the change sends days with times instead.
    preferredDays = sortDays(preferences.map((p) => p.weekday));
  }

  if (body.consent !== true) add("consent", "Tick the box to agree, so Xello can contact you about this application.");

  if (Object.keys(errors).length) return { data: null, errors };
  return {
    data: {
      studentName: studentName!,
      grade: grade!,
      board: board!,
      schoolName,
      medium,
      subjectIds: chosen,
      guardianName: guardianName!,
      relationship: relationship!,
      whatsappNumber: whatsappNumber!,
      altPhone,
      email,
      country: country!,
      city,
      helpAreas,
      teachingLanguage,
      startDate,
      notes,
      preferredDays,
      preferences,
      consent: true,
    },
    errors,
  };
}

export const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.value, label: c.label, dialCode: c.dialCode }));
