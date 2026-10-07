import { Prisma, Teacher } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { FieldCollector } from "../validation";
import { COUNTRY_VALUES, findCountry } from "../constants";
import { ApiError, forbiddenError, notFoundError, validationError } from "../api-errors";
import { canManageTeacherRates, canViewTeacherRates } from "../auth";
import { GradeRateOverrides, RATE_LIMITS, RATE_TIERS, RateTierKey, parseGradeRates, serializeGradeRates } from "../rates";
import { rememberIdempotentEntity, runIdempotent } from "../idempotency";
import { FieldErrorMap, checkInternationalPhone, phonesMatch } from "../validation";
import { readDays } from "../trainer-profile";

const RATE_FIELDS = ["defaultRate", "gradeRates"] as const;

export interface TeacherFields {
  name?: string;
  email?: string;
  phone?: string;
  subjects?: string;
  grades?: string;
  country?: string;
  timeZone?: string;
  defaultRate?: number;
  gradeRates?: string | null;
  active?: boolean;
  location?: string | null;
  qualification?: string | null;
  syllabus?: string | null;
  devices?: string | null;
  availableDays?: string | null;
  availableTimes?: string | null;
  whatsapp?: string | null;
  notes?: string | null;
}

/** Profile fields that are optional free text, with their limits. */
const PROFILE_TEXT: { key: "location" | "qualification" | "availableTimes" | "notes"; label: string; max: number }[] = [
  { key: "location", label: "Place", max: 100 },
  { key: "qualification", label: "Qualification", max: 200 },
  { key: "availableTimes", label: "Available times", max: 200 },
  { key: "notes", label: "Internal notes", max: 1000 },
];

/** Accepts ["CBSE", "ICSE"] or "CBSE, ICSE"; empty → null. */
function optionalList(v: FieldCollector, field: string, value: unknown, label: string, max: number): string | null {
  const items = (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!items.length) return null;
  const text = [...new Set(items)].join(", ");
  if (text.length > max) v.add(field, `${label} must be ${max} characters or fewer.`);
  return text;
}

/** Accepts ["Maths", "Physics"] or "Maths, Physics"; returns "Maths, Physics". */
function parseList(v: FieldCollector, field: string, value: unknown, label: string): string {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    if (text.length > 60) {
      v.add(field, `Each ${label.toLowerCase()} entry must be 60 characters or fewer.`);
      continue;
    }
    seen.add(text.toLowerCase());
    clean.push(text);
  }
  if (clean.length === 0) v.add(field, `Select at least one ${label.toLowerCase()}.`);
  if (clean.length > 30) v.add(field, `Select no more than 30 ${label.toLowerCase()}.`);
  return clean.join(", ");
}

function parseRateOverrides(v: FieldCollector, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  let source: unknown = value;
  if (typeof value === "string") {
    try {
      source = JSON.parse(value);
    } catch {
      v.add("gradeRates", "Grade rates could not be read.");
      return null;
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    v.add("gradeRates", "Grade rates could not be read.");
    return null;
  }
  const overrides: GradeRateOverrides = {};
  for (const tier of RATE_TIERS) {
    const raw = (source as Record<string, unknown>)[tier.key];
    if (raw === undefined || raw === null || raw === "") continue;
    overrides[tier.key] = v.integer(`gradeRates.${tier.key}`, raw, `${tier.label} rate`, RATE_LIMITS);
  }
  // Keep legacy-keyed values that were not resubmitted under the new keys.
  const legacy = parseGradeRates(JSON.stringify(source));
  for (const key of Object.keys(legacy) as RateTierKey[]) {
    if (overrides[key] === undefined) overrides[key] = legacy[key];
  }
  return serializeGradeRates(overrides);
}

/**
 * Validates a create (partial = false) or update (partial = true) payload and
 * returns the fields plus any per-field errors (used directly by the importer).
 * Only fields present in the body are validated for updates.
 */
export function collectTeacherFields(
  body: Record<string, unknown>,
  { partial, user }: { partial: boolean; user: CurrentUser }
): { fields: TeacherFields; errors: FieldErrorMap } {
  const v = new FieldCollector();
  const has = (key: string) => !partial || Object.prototype.hasOwnProperty.call(body, key);
  const fields: TeacherFields = {};

  const sendsRates = RATE_FIELDS.some((f) => body[f] !== undefined);
  if (sendsRates && !canManageTeacherRates(user.role)) {
    throw forbiddenError("Only the owner can set trainer pay rates. Remove the rate fields and try again.");
  }

  if (has("name")) fields.name = v.requiredText("name", body.name, "Full name", 100);
  if (has("email")) fields.email = v.email("email", body.email, "Email address", true) ?? undefined;
  if (has("phone")) fields.phone = v.phone("phone", body.phone, "Phone / WhatsApp number");
  if (has("subjects")) fields.subjects = parseList(v, "subjects", body.subjects, "Subject");
  if (has("grades")) fields.grades = parseList(v, "grades", body.grades, "Grade");

  if (has("country")) {
    fields.country = v.oneOf("country", body.country, COUNTRY_VALUES, "Country", "India");
  }
  // India time only: trainers are scheduled in IST whatever their country.
  if (has("timeZone")) fields.timeZone = "Asia/Kolkata";

  if (body.defaultRate !== undefined) {
    fields.defaultRate = v.integer("defaultRate", body.defaultRate, "Base hourly rate", RATE_LIMITS);
  }
  if (body.gradeRates !== undefined) fields.gradeRates = parseRateOverrides(v, body.gradeRates);

  if (partial && body.active !== undefined) {
    if (typeof body.active !== "boolean") v.add("active", "Active must be true or false.");
    else fields.active = body.active;
  }

  for (const f of PROFILE_TEXT) {
    if (has(f.key)) fields[f.key] = v.optionalText(f.key, body[f.key], f.label, f.max);
  }
  if (has("syllabus")) fields.syllabus = optionalList(v, "syllabus", body.syllabus, "Syllabus", 200);
  if (has("devices")) fields.devices = optionalList(v, "devices", body.devices, "Devices", 100);
  if (has("availableDays")) {
    const days = readDays(body.availableDays);
    fields.availableDays = days.length ? days.join(", ") : null;
  }
  if (has("whatsapp")) {
    const raw = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
    if (!raw || raw.replace(/\D/g, "").length <= 3) fields.whatsapp = null;
    else {
      const check = checkInternationalPhone(raw);
      if (!check.ok) v.add("whatsapp", check.error || "Enter the WhatsApp number with country code.");
      fields.whatsapp = check.display;
    }
  }

  return { fields, errors: v.errors };
}

/** As collectTeacherFields, but throws a 400 with per-field messages when anything is invalid. */
export function parseTeacherFields(
  body: Record<string, unknown>,
  opts: { partial: boolean; user: CurrentUser }
): TeacherFields {
  const { fields, errors } = collectTeacherFields(body, opts);
  if (Object.keys(errors).length) throw validationError("Please correct the highlighted fields.", errors);
  return fields;
}

async function assertEmailAvailable(db: Prisma.TransactionClient, email: string, exceptId?: string) {
  const all = await db.teacher.findMany({ select: { id: true, email: true } });
  const clash = all.find((t) => t.id !== exceptId && t.email.toLowerCase() === email.toLowerCase());
  if (clash) {
    throw new ApiError(409, "DUPLICATE", "A trainer with this email address already exists.", {
      fieldErrors: { email: "This email is already used by another trainer." },
    });
  }
}

const teacherCounts = {
  _count: {
    select: {
      enrolments: { where: { status: "ACTIVE" } },
      sessions: { where: { isCreditConsumed: true } },
    },
  },
} satisfies Prisma.TeacherInclude;

type TeacherWithCounts = Prisma.TeacherGetPayload<{ include: typeof teacherCounts }>;

function profileData(fields: TeacherFields) {
  return {
    location: fields.location ?? null,
    qualification: fields.qualification ?? null,
    syllabus: fields.syllabus ?? null,
    devices: fields.devices ?? null,
    availableDays: fields.availableDays ?? null,
    availableTimes: fields.availableTimes ?? null,
    whatsapp: fields.whatsapp ?? null,
    notes: fields.notes ?? null,
  };
}

/** Directory / API shape: profile, permitted rate data and activity counts only. */
export function presentTeacher(teacher: Teacher | TeacherWithCounts, viewer: CurrentUser) {
  const counts = "_count" in teacher ? teacher._count : { enrolments: 0, sessions: 0 };
  const ratesVisible = canViewTeacherRates(viewer.role, viewer.teacherId, teacher.id);
  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    subjects: teacher.subjects,
    grades: teacher.grades,
    country: teacher.country,
    timeZone: teacher.timeZone,
    active: teacher.active,
    defaultRate: ratesVisible ? teacher.defaultRate : null,
    gradeRates: ratesVisible ? teacher.gradeRates : null,
    ratesVisible,
    location: teacher.location,
    qualification: teacher.qualification,
    syllabus: teacher.syllabus,
    devices: teacher.devices,
    availableDays: teacher.availableDays,
    availableTimes: teacher.availableTimes,
    whatsapp: teacher.whatsapp,
    // Internal notes are for staff; a trainer viewing their own profile does not get them.
    notes: viewer.role === "TEACHER" ? null : teacher.notes,
    assignedCount: counts.enrolments,
    taughtCount: counts.sessions,
  };
}

export type TeacherListItem = ReturnType<typeof presentTeacher>;

export async function listTeachersFor(viewer: CurrentUser, { activeOnly = false } = {}) {
  const where: Prisma.TeacherWhereInput = {};
  if (activeOnly) where.active = true;
  if (viewer.role === "TEACHER") where.id = viewer.teacherId ?? "__none__";
  const teachers = await prisma.teacher.findMany({ where, include: teacherCounts, orderBy: { name: "asc" } });
  return teachers.map((t) => presentTeacher(t, viewer));
}

export async function createTeacher(fields: TeacherFields, user: CurrentUser, idempotencyKey: string | null) {
  const { result, replayed } = await runIdempotent(
    "CREATE_TEACHER",
    idempotencyKey,
    () =>
      prisma.$transaction(async (tx) => {
        await assertEmailAvailable(tx, fields.email!);
        const teacher = await tx.teacher.create({
          data: {
            name: fields.name!,
            email: fields.email!,
            phone: fields.phone!,
            subjects: fields.subjects!,
            grades: fields.grades!,
            country: fields.country ?? "India",
            timeZone: fields.timeZone ?? "Asia/Kolkata",
            ...(fields.defaultRate !== undefined ? { defaultRate: fields.defaultRate } : {}),
            gradeRates: fields.gradeRates ?? null,
            active: true,
            ...profileData(fields),
          },
          include: teacherCounts,
        });
        await tx.auditLog.create({
          data: {
            entityType: "TEACHER",
            entityId: teacher.id,
            action: "CREATE_TEACHER",
            actorRole: user.role,
            actorName: user.name,
            details: JSON.stringify({
              name: teacher.name,
              email: teacher.email,
              subjects: teacher.subjects,
              defaultRate: teacher.defaultRate,
              gradeRates: teacher.gradeRates,
              country: teacher.country,
            }),
          },
        });
        await rememberIdempotentEntity(tx, "CREATE_TEACHER", idempotencyKey, teacher.id);
        return teacher;
      }),
    (id) => prisma.teacher.findUnique({ where: { id }, include: teacherCounts })
  );
  return { teacher: presentTeacher(result, user), replayed };
}

export async function updateTeacher(id: string, fields: TeacherFields, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.teacher.findUnique({ where: { id } });
    if (!existing) throw notFoundError("This trainer no longer exists. Refresh the page.");
    if (fields.email) await assertEmailAvailable(tx, fields.email, id);

    const updated = await tx.teacher.update({ where: { id }, data: fields });

    if (fields.active !== undefined && existing.active !== fields.active) {
      await tx.user.updateMany({
        where: { teacherId: id },
        data: { active: fields.active },
      });
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(fields) as (keyof TeacherFields)[]) {
      if (existing[key] !== updated[key]) changes[key] = { from: existing[key], to: updated[key] };
    }
    await tx.auditLog.create({
      data: {
        entityType: "TEACHER",
        entityId: id,
        action: fields.active === false && existing.active ? "DEACTIVATE_TEACHER" : "UPDATE_TEACHER",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ name: updated.name, changes }),
      },
    });

    let warning: string | undefined;
    if (existing.active && updated.active === false) {
      const now = new Date();
      const [activeEnrolments, upcomingSessions, weeklySlots] = await Promise.all([
        tx.subjectEnrollment.count({ where: { teacherId: id, status: "ACTIVE" } }),
        tx.session.count({ where: { teacherId: id, status: "SCHEDULED", scheduledStartTimeUtc: { gt: now } } }),
        tx.timetableSlot.count({ where: { teacherId: id, active: true, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] } }),
      ]);
      if (activeEnrolments || upcomingSessions || weeklySlots) {
        warning = `${updated.name} is now inactive but still has ${activeEnrolments} student enrolment(s), ${weeklySlots} weekly timetable slot(s) and ${upcomingSessions} upcoming class(es). No new classes will be booked for them; reassign these from the student profiles.`;
      }
    }
    return { teacher: presentTeacher(updated, user), warning };
  });
}

export async function deleteTeacher(id: string, user: CurrentUser) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      user: { select: { id: true } },
      _count: { select: { enrolments: true, sessions: true, payoutItems: true, progressNotes: true, assessments: true, timetableSlots: true } },
    },
  });
  if (!teacher) throw notFoundError("This trainer no longer exists. Refresh the page.");

  const c = teacher._count;
  if (c.enrolments || c.sessions || c.payoutItems || c.progressNotes || c.assessments || c.timetableSlots) {
    throw new ApiError(
      409,
      "HAS_HISTORY",
      `${teacher.name} has ${c.enrolments} enrolment(s), ${c.sessions} session(s) and ${c.payoutItems} payout item(s). Deactivate the trainer instead so attendance, payouts and history stay intact.`,
      { details: { ...c, hasLoginAccount: Boolean(teacher.user) } }
    );
  }

  await prisma.$transaction(async (tx) => {
    if (teacher.user) {
      await tx.user.delete({ where: { id: teacher.user.id } });
    }
    await tx.teacher.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        entityType: "TEACHER",
        entityId: id,
        action: "DELETE_TEACHER",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ name: teacher.name, email: teacher.email, phone: teacher.phone }),
      },
    });
  });
  return { name: teacher.name };
}

// ---------------------------------------------------------------------------
// Bulk import from the trainer sign-up sheet (rows are parsed in the browser,
// which never reads the bank-details column).

export const MAX_IMPORT_ROWS = 300;
const IMPORT_KEYS = [
  "name", "email", "phone", "subjects", "grades", "location", "qualification",
  "syllabus", "devices", "availableDays", "availableTimes", "whatsapp", "notes",
] as const;

export interface ImportRowResult {
  index: number;
  name: string;
  status: "ready" | "created" | "exists" | "invalid";
  messages: string[];
}

/**
 * Checks (dryRun) or creates trainers from sheet rows. Rows whose email or phone
 * already belongs to a trainer are skipped, never merged; pay rates in a row are
 * ignored. Creation is all-or-nothing and logged per trainer.
 */
export async function importTeachers(rawRows: unknown, user: CurrentUser, { dryRun }: { dryRun: boolean }) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) throw validationError("Paste at least one trainer row.");
  if (rawRows.length > MAX_IMPORT_ROWS) throw validationError(`Import up to ${MAX_IMPORT_ROWS} trainers at a time.`);

  const prepared = rawRows.map((raw, index) => {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const body: Record<string, unknown> = {};
    for (const key of IMPORT_KEYS) if (key in source) body[key] = source[key];
    const { fields, errors } = collectTeacherFields(body, { partial: false, user });
    return { index, fields, errors };
  });

  type Evaluated = ImportRowResult & { fields: TeacherFields };
  const evaluate = async (db: Prisma.TransactionClient | typeof prisma): Promise<Evaluated[]> => {
    const existing = await db.teacher.findMany({ select: { name: true, email: true, phone: true } });
    const byEmail = new Map(existing.map((t) => [t.email.toLowerCase(), t]));
    const seenEmail = new Map<string, string>();
    const seenPhone: { phone: string; name: string }[] = [];
    return prepared.map(({ index, fields, errors }) => {
      const name = fields.name || `Row ${index + 1}`;
      const messages = Object.values(errors);
      if (messages.length) return { index, name, status: "invalid", messages, fields };
      const email = fields.email!.toLowerCase();
      const sameEmail = byEmail.get(email);
      if (sameEmail) return { index, name, status: "exists", messages: [`Already in the app as ${sameEmail.name} (same email).`], fields };
      const samePhone = existing.find((t) => phonesMatch(t.phone, fields.phone));
      if (samePhone) {
        return { index, name, status: "exists", messages: [`The phone number already belongs to trainer ${samePhone.name}. Not added; add by hand if this is a different person.`], fields };
      }
      const dupEmail = seenEmail.get(email);
      if (dupEmail) return { index, name, status: "invalid", messages: [`Same email as ${dupEmail} in this list.`], fields };
      const dupPhone = seenPhone.find((p) => phonesMatch(p.phone, fields.phone));
      if (dupPhone) return { index, name, status: "invalid", messages: [`Same phone number as ${dupPhone.name} in this list.`], fields };
      seenEmail.set(email, name);
      seenPhone.push({ phone: fields.phone!, name });
      return { index, name, status: "ready", messages: [], fields };
    });
  };
  const publicRow = ({ index, name, status, messages }: Evaluated): ImportRowResult => ({ index, name, status, messages });

  if (dryRun) {
    const rows = await evaluate(prisma);
    return { dryRun: true, created: 0, results: rows.map(publicRow) };
  }

  const rows = await prisma.$transaction(
    async (tx) => {
      const evaluated = await evaluate(tx);
      for (const row of evaluated) {
        if (row.status !== "ready") continue;
        const f = row.fields;
        const teacher = await tx.teacher.create({
          data: {
            name: f.name!,
            email: f.email!,
            phone: f.phone!,
            subjects: f.subjects!,
            grades: f.grades!,
            country: f.country ?? "India",
            timeZone: "Asia/Kolkata",
            active: true,
            ...profileData(f),
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: "TEACHER",
            entityId: teacher.id,
            action: "IMPORT_TEACHER",
            actorRole: user.role,
            actorName: user.name,
            details: JSON.stringify({ name: teacher.name, email: teacher.email, subjects: teacher.subjects, source: "trainer sign-up sheet" }),
          },
        });
        row.status = "created";
      }
      return evaluated;
    },
    { timeout: 30000, maxWait: 10000 }
  );
  return { dryRun: false, created: rows.filter((r) => r.status === "created").length, results: rows.map(publicRow) };
}
