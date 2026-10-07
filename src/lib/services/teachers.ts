import { Prisma, Teacher } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { FieldCollector } from "../validation";
import { COUNTRY_VALUES, findCountry } from "../constants";
import { ApiError, forbiddenError, notFoundError, validationError } from "../api-errors";
import { canManageTeacherRates, canViewTeacherRates } from "../auth";
import { GradeRateOverrides, RATE_LIMITS, RATE_TIERS, RateTierKey, parseGradeRates, serializeGradeRates } from "../rates";
import { rememberIdempotentEntity, runIdempotent } from "../idempotency";

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
 * Validates a create (partial = false) or update (partial = true) payload.
 * Only fields present in the body are validated for updates.
 */
export function parseTeacherFields(
  body: Record<string, unknown>,
  { partial, user }: { partial: boolean; user: CurrentUser }
): TeacherFields {
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
  if (has("timeZone")) {
    const fallback = findCountry(fields.country)?.timeZone ?? "Asia/Kolkata";
    fields.timeZone = v.timeZone("timeZone", body.timeZone, fallback);
  }

  if (body.defaultRate !== undefined) {
    fields.defaultRate = v.integer("defaultRate", body.defaultRate, "Base hourly rate", RATE_LIMITS);
  }
  if (body.gradeRates !== undefined) fields.gradeRates = parseRateOverrides(v, body.gradeRates);

  if (partial && body.active !== undefined) {
    if (typeof body.active !== "boolean") v.add("active", "Active must be true or false.");
    else fields.active = body.active;
  }

  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);
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
