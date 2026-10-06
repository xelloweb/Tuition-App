/**
 * Weekly timetable: recurring subject slots (template) and the dated class
 * occurrences generated from them.
 *
 * - A slot stores weekday + local start/end minutes + IANA time zone. It never
 *   reserves or consumes credits by itself.
 * - Occurrences are ordinary Session rows linked by (timetableSlotId,
 *   occurrenceDate); that unique pair makes generation idempotent.
 * - Occurrences are generated only inside a bounded window and only when an
 *   active package for the subject has unreserved credit, is valid on that date
 *   and uses the same class length. Credits are never taken from another subject.
 * - Edits apply to future classes only; slots with history are versioned or
 *   deactivated instead of deleted.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { ApiError, notFoundError, uniqueTargetIncludes, validationError } from "../api-errors";
import { calculatePackageBalances } from "../package-calculations";
import { BusySession, findClash, loadBusySessions, lockPackages, overlaps } from "../scheduling";
import {
  WEEKDAYS,
  addDaysToLocalDate,
  formatMinutes,
  localDateInZone,
  parseTimeOfDay,
  weekdayOfLocalDate,
  zonedTimeToUtc,
} from "../zoned-time";
import { isValidTimeZone } from "../validation";
import { BUSINESS_TIME_ZONE } from "../constants";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

export const TIMETABLE_WINDOW_DAYS = 28;
const CONFLICT_HORIZON_DAYS = 14;
const MIN_SLOT_MINUTES = 15;
const MAX_SLOT_MINUTES = 240;
const MAX_SLOTS = 100;

export interface SlotInput {
  id?: string | null;
  enrolmentId?: string;
  teacherId?: string | null;
  weekday?: number;
  start?: string;
  end?: string;
}

export interface PlannedSlot {
  ref: string;
  index: number;
  existingId: string | null;
  change: "unchanged" | "create" | "update" | "version";
  enrolmentId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
  teacherActive: boolean;
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  timeZone: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
}

export interface PlannedOccurrence {
  slotRef: string;
  occurrenceDate: string;
  start: Date;
  end: Date;
  packageId: string;
  packageNumber: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
}

export type IssueReason =
  | "STUDENT_NOT_ACTIVE"
  | "NO_TRAINER"
  | "TRAINER_INACTIVE"
  | "CONFLICT"
  | "NO_PACKAGE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "DURATION_MISMATCH"
  | "NO_CREDITS";

export interface OccurrenceIssue {
  slotRef: string;
  reason: IssueReason;
  subjectName: string;
  count: number;
  firstDate: string;
  message: string;
}

interface SlotRow {
  id: string;
  enrolmentId: string;
  teacherId: string | null;
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  timeZone: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  active: boolean;
}

export interface TimetablePlan {
  timeZone: string;
  slots: PlannedSlot[];
  removals: { slot: SlotRow; mode: "deactivate" | "delete"; subjectName: string }[];
  versioned: { oldId: string; ref: string }[];
  releasedSessions: { id: string; start: Date; end: Date; subjectName: string; teacherName: string; packageId: string; subjectId: string }[];
  occurrences: PlannedOccurrence[];
  issues: OccurrenceIssue[];
  summary: { added: number; edited: number; removed: number; unchanged: number; released: number; toBook: number };
}

const dayName = (weekday: number) => WEEKDAYS[weekday]?.long ?? `Day ${weekday}`;
const slotLabel = (s: { weekday: number; startMinutes: number; endMinutes: number }) =>
  `${dayName(s.weekday)} ${formatMinutes(s.startMinutes)}–${formatMinutes(s.endMinutes)}`;

/** Current = active and not yet ended. */
function currentSlotWhere(now: Date): Prisma.TimetableSlotWhereInput {
  return { active: true, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] };
}

async function slotHasHistory(db: Db, slotId: string, now: Date): Promise<boolean> {
  const count = await db.session.count({
    where: {
      timetableSlotId: slotId,
      OR: [
        { scheduledStartTimeUtc: { lt: now } },
        { status: { not: "SCHEDULED" } },
        { isCreditConsumed: true },
        { attendance: { isNot: null } },
      ],
    },
  });
  return count > 0;
}

/** Concrete occurrences of a slot between two local dates (inclusive start, exclusive end). */
function occurrencesBetween(
  slot: Pick<PlannedSlot, "weekday" | "startMinutes" | "endMinutes" | "timeZone" | "effectiveFrom" | "effectiveUntil">,
  fromLocalDate: string,
  days: number
) {
  const result: { date: string; start: Date; end: Date }[] = [];
  const offset = (slot.weekday - weekdayOfLocalDate(fromLocalDate) + 7) % 7;
  for (let d = offset; d < days; d += 7) {
    const date = addDaysToLocalDate(fromLocalDate, d);
    const start = zonedTimeToUtc(date, slot.startMinutes, slot.timeZone);
    const end = zonedTimeToUtc(date, slot.endMinutes, slot.timeZone);
    if (start < slot.effectiveFrom) continue;
    if (slot.effectiveUntil && start >= slot.effectiveUntil) continue;
    result.push({ date, start, end });
  }
  return result;
}

async function loadStudentContext(db: Db, studentId: string, now: Date) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, status: true, timeZone: true },
  });
  if (!student) throw notFoundError("This student no longer exists. Refresh the page.");
  const enrolments = await db.subjectEnrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    include: { subject: true, teacher: { select: { id: true, name: true, active: true } } },
    orderBy: { createdAt: "asc" },
  });
  const currentSlots: SlotRow[] = await db.timetableSlot.findMany({
    where: { enrolment: { studentId }, ...currentSlotWhere(now) },
    orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }],
  });
  return { student, enrolments, currentSlots };
}

/**
 * Builds the full change plan. Reads only, so it serves both the preview and
 * (inside the save transaction) the authoritative execution.
 * `input === null` keeps the current slots unchanged (used by "generate").
 */
export async function buildTimetablePlan(
  db: Db,
  studentId: string,
  input: { timeZone?: unknown; slots?: unknown } | null,
  now: Date = new Date()
): Promise<TimetablePlan> {
  const { student, enrolments, currentSlots } = await loadStudentContext(db, studentId, now);
  const enrolmentById = new Map(enrolments.map((e) => [e.id, e]));
  const currentById = new Map(currentSlots.map((s) => [s.id, s]));
  const errors: Record<string, string> = {};

  // ---- time zone ----
  let timeZone = currentSlots[0]?.timeZone ?? student.timeZone ?? BUSINESS_TIME_ZONE;
  if (input) {
    if (typeof input.timeZone === "string" && input.timeZone.trim()) {
      if (isValidTimeZone(input.timeZone.trim())) timeZone = input.timeZone.trim();
      else errors.timeZone = "Choose a valid time zone.";
    }
  }

  // ---- parse the desired slot list ----
  const rawSlots: SlotInput[] = input
    ? Array.isArray(input.slots)
      ? (input.slots as SlotInput[])
      : []
    : currentSlots.map((s) => ({ id: s.id }));
  if (input && !Array.isArray(input.slots)) errors.slots = "Slots must be a list.";
  if (rawSlots.length > MAX_SLOTS) errors.slots = `A timetable can have up to ${MAX_SLOTS} weekly slots.`;

  const teacherIds = new Set<string>();
  for (const raw of rawSlots) if (raw && typeof raw.teacherId === "string" && raw.teacherId) teacherIds.add(raw.teacherId);
  for (const slot of currentSlots) if (slot.teacherId) teacherIds.add(slot.teacherId);
  const teachers = new Map(
    (await db.teacher.findMany({ where: { id: { in: [...teacherIds] } }, select: { id: true, name: true, active: true } })).map(
      (t) => [t.id, t]
    )
  );

  const slots: PlannedSlot[] = [];
  rawSlots.forEach((raw, index) => {
    const key = (f: string) => `slots.${index}.${f}`;
    const existing = raw?.id ? currentById.get(raw.id) : undefined;
    if (raw?.id && !existing) {
      errors[key("id")] = "This slot was changed or removed elsewhere. Refresh the timetable and try again.";
      return;
    }
    // "generate" path: keep stored values exactly.
    const source = input ? raw : existing!;
    const enrolmentId = input ? raw.enrolmentId : existing!.enrolmentId;
    const enrolment = enrolmentId ? enrolmentById.get(enrolmentId) : undefined;
    if (!enrolment) {
      errors[key("enrolmentId")] = "Choose one of the student's enrolled subjects.";
      return;
    }

    let weekday: number;
    let startMinutes: number | null;
    let endMinutes: number | null;
    if (input) {
      weekday = Number((source as SlotInput).weekday);
      startMinutes = parseTimeOfDay((source as SlotInput).start);
      endMinutes = parseTimeOfDay((source as SlotInput).end);
    } else {
      weekday = existing!.weekday;
      startMinutes = existing!.startMinutes;
      endMinutes = existing!.endMinutes;
    }
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) errors[key("weekday")] = "Choose a day of the week.";
    if (startMinutes === null) errors[key("start")] = "Enter a start time.";
    if (endMinutes === null) errors[key("end")] = "Enter an end time.";
    if (startMinutes !== null && endMinutes !== null) {
      if (endMinutes <= startMinutes) {
        errors[key("end")] =
          "End time must be after the start time on the same day. Overnight classes aren't supported yet — split them into two entries (for example 10:00–11:59 PM and 12:00–1:00 AM next day).";
      } else if (endMinutes - startMinutes < MIN_SLOT_MINUTES || endMinutes - startMinutes > MAX_SLOT_MINUTES) {
        errors[key("end")] = `Classes must be between ${MIN_SLOT_MINUTES} and ${MAX_SLOT_MINUTES} minutes long.`;
      }
    }

    // Trainer: explicit choice, otherwise the subject's assigned trainer.
    let teacherId: string | null = input
      ? typeof raw.teacherId === "string" && raw.teacherId
        ? raw.teacherId
        : enrolment.teacherId
      : existing!.teacherId;
    let teacherName: string | null = null;
    let teacherActive = false;
    if (teacherId) {
      const t = teachers.get(teacherId) ?? (enrolment.teacher?.id === teacherId ? enrolment.teacher : undefined);
      if (!t) {
        if (input) errors[key("teacherId")] = "This trainer no longer exists. Choose another trainer.";
        teacherId = null;
      } else {
        teacherName = t.name;
        teacherActive = t.active;
        const unchangedTrainer = existing?.teacherId === teacherId;
        if (!t.active && input && !unchangedTrainer && teacherId !== enrolment.teacherId) {
          errors[key("teacherId")] = `${t.name} is inactive. Choose an active trainer.`;
        }
      }
    }

    if (errors[key("weekday")] || errors[key("start")] || errors[key("end")] || startMinutes === null || endMinutes === null) {
      return;
    }

    const changed =
      !existing ||
      existing.enrolmentId !== enrolment.id ||
      existing.teacherId !== teacherId ||
      existing.weekday !== weekday ||
      existing.startMinutes !== startMinutes ||
      existing.endMinutes !== endMinutes ||
      existing.timeZone !== timeZone;

    slots.push({
      ref: existing ? existing.id : `new:${index}`,
      index,
      existingId: existing?.id ?? null,
      change: !existing ? "create" : changed ? "update" : "unchanged",
      enrolmentId: enrolment.id,
      subjectId: enrolment.subjectId,
      subjectName: enrolment.subject.name,
      teacherId,
      teacherName,
      teacherActive,
      weekday,
      startMinutes,
      endMinutes,
      timeZone: existing && !changed ? existing.timeZone : timeZone,
      effectiveFrom: existing && !changed ? existing.effectiveFrom : now,
      effectiveUntil: existing && !changed ? existing.effectiveUntil : null,
    });
  });

  // ---- duplicates and student overlaps (all slots share the timetable zone) ----
  const today = localDateInZone(now, timeZone);
  const horizon = slots.map((s) => occurrencesBetween({ ...s, effectiveFrom: new Date(0) }, today, CONFLICT_HORIZON_DAYS));
  for (let i = 0; i < slots.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = slots[i];
      const b = slots[j];
      const field = `slots.${a.index}.start`;
      if (errors[field]) continue;
      if (a.enrolmentId === b.enrolmentId && a.weekday === b.weekday && a.startMinutes === b.startMinutes && a.endMinutes === b.endMinutes) {
        errors[field] = `Duplicate: ${a.subjectName} already has ${slotLabel(b)}.`;
        continue;
      }
      const clash = horizon[i].some((x) => horizon[j].some((y) => overlaps(x.start, x.end, y.start, y.end)));
      if (clash) {
        errors[field] = `Overlaps ${b.subjectName} on ${slotLabel(b)}. Back-to-back classes are fine; overlapping ones are not.`;
      }
    }
  }

  // ---- trainer conflicts with other students' recurring slots ----
  const slotTeacherIds = [...new Set(slots.map((s) => s.teacherId).filter((id): id is string => Boolean(id)))];
  if (slotTeacherIds.length) {
    const others = await db.timetableSlot.findMany({
      where: { teacherId: { in: slotTeacherIds }, enrolment: { studentId: { not: studentId } }, ...currentSlotWhere(now) },
      include: { enrolment: { include: { student: { select: { name: true } }, subject: { select: { name: true } } } } },
    });
    slots.forEach((s, i) => {
      const field = `slots.${s.index}.start`;
      if (!s.teacherId || errors[field]) return;
      for (const other of others.filter((o) => o.teacherId === s.teacherId)) {
        const otherOcc = occurrencesBetween(other, today, CONFLICT_HORIZON_DAYS);
        if (horizon[i].some((x) => otherOcc.some((y) => overlaps(x.start, x.end, y.start, y.end)))) {
          errors[field] = `${s.teacherName} already teaches ${other.enrolment.student.name} (${other.enrolment.subject.name}) on ${slotLabel(other)} ${other.timeZone}.`;
          break;
        }
      }
    });
  }

  // ---- packages: class length rule + credit pool ----
  const packages = await db.studentPackage.findMany({
    where: { studentId, status: "ACTIVE" },
    include: { allocations: true },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });
  const todayBusiness = localDateInZone(now, BUSINESS_TIME_ZONE);
  for (const s of slots) {
    const field = `slots.${s.index}.end`;
    if (errors[field] || s.change === "unchanged") continue;
    const applicable = packages.filter(
      (p) =>
        p.allocations.some((a) => a.subjectId === s.subjectId) &&
        (!p.expiryDate || localDateInZone(p.expiryDate, BUSINESS_TIME_ZONE) >= todayBusiness)
    );
    const length = s.endMinutes - s.startMinutes;
    if (applicable.length && !applicable.some((p) => p.durationMinutes === length)) {
      errors[field] = `${s.subjectName} classes are ${applicable[0].durationMinutes} minutes in package ${applicable[0].packageNumber}; this slot is ${length} minutes.`;
    }
  }

  if (Object.keys(errors).length) {
    throw validationError("Some timetable slots need attention.", errors);
  }

  // ---- version or update changed slots, remove the rest ----
  const versioned: TimetablePlan["versioned"] = [];
  for (const s of slots) {
    if (s.change === "update" && s.existingId && (await slotHasHistory(db, s.existingId, now))) {
      s.change = "version";
      versioned.push({ oldId: s.existingId, ref: `version:${s.existingId}` });
      s.ref = `version:${s.existingId}`;
    }
  }
  const keptIds = new Set(slots.map((s) => s.existingId).filter(Boolean));
  const removals: TimetablePlan["removals"] = [];
  for (const slot of currentSlots) {
    if (keptIds.has(slot.id)) continue;
    removals.push({
      slot,
      mode: (await slotHasHistory(db, slot.id, now)) ? "deactivate" : "delete",
      subjectName: enrolmentById.get(slot.enrolmentId)?.subject.name ?? "Subject",
    });
  }

  // Future, unattended classes of changed/removed slots are released and regenerated.
  const touchedIds = [
    ...slots.filter((s) => s.existingId && (s.change === "update" || s.change === "version")).map((s) => s.existingId!),
    ...removals.map((r) => r.slot.id),
  ];
  const released = touchedIds.length
    ? await db.session.findMany({
        where: {
          timetableSlotId: { in: touchedIds },
          status: "SCHEDULED",
          isCreditConsumed: false,
          attendance: { is: null },
          scheduledStartTimeUtc: { gte: now },
        },
        include: { subject: { select: { name: true } }, teacher: { select: { name: true } } },
        orderBy: { scheduledStartTimeUtc: "asc" },
      })
    : [];
  const releasedIds = new Set(released.map((r) => r.id));

  // Dates already taken by each kept slot (generated classes and exceptions).
  const takenDates = new Map<string, Set<string>>();
  const linked = await db.session.findMany({
    where: { timetableSlotId: { in: currentSlots.map((s) => s.id) }, occurrenceDate: { not: null } },
    select: { id: true, timetableSlotId: true, occurrenceDate: true, status: true, scheduledStartTimeUtc: true },
  });
  for (const row of linked) {
    if (releasedIds.has(row.id) || !row.timetableSlotId || !row.occurrenceDate) continue;
    const target = slots.find((s) => s.existingId === row.timetableSlotId);
    if (!target) continue;
    // A versioned slot inherits only its predecessor's cancelled/rescheduled exceptions.
    if (target.change === "version" && (row.status === "SCHEDULED" || row.scheduledStartTimeUtc < now)) continue;
    const set = takenDates.get(target.ref) ?? new Set<string>();
    set.add(row.occurrenceDate);
    takenDates.set(target.ref, set);
  }

  // ---- generate occurrences inside the window ----
  const windowEnd = new Date(now.getTime() + TIMETABLE_WINDOW_DAYS * 24 * 3600 * 1000);
  const busy: BusySession[] = await loadBusySessions(db as Tx, {
    studentIds: [studentId],
    teacherIds: slotTeacherIds,
    from: now,
    to: windowEnd,
    excludeIds: [...releasedIds],
  });

  // Unreserved credit per package + subject (released reservations are returned to the pool).
  const pool = new Map<string, number>();
  for (const pkg of packages) {
    const balance = await calculatePackageBalances(pkg.id, db);
    for (const sub of balance?.subjects ?? []) pool.set(`${pkg.id}:${sub.subjectId}`, sub.availableCredits);
  }
  for (const r of released) {
    const k = `${r.packageId}:${r.subjectId}`;
    if (pool.has(k)) pool.set(k, (pool.get(k) ?? 0) + 1);
  }

  const candidates = slots
    .flatMap((s) =>
      occurrencesBetween(s, localDateInZone(now, s.timeZone), TIMETABLE_WINDOW_DAYS + 1).map((o) => ({ slot: s, ...o }))
    )
    .filter((c) => c.start > now && c.start < windowEnd && !takenDates.get(c.slot.ref)?.has(c.date))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const issueMap = new Map<string, OccurrenceIssue>();
  const addIssue = (slot: PlannedSlot, reason: IssueReason, date: string, message: string) => {
    const k = reason === "CONFLICT" ? `${slot.ref}:${reason}:${date}` : `${slot.ref}:${reason}`;
    const existing = issueMap.get(k);
    if (existing) existing.count++;
    else issueMap.set(k, { slotRef: slot.ref, reason, subjectName: slot.subjectName, count: 1, firstDate: date, message });
  };

  const occurrences: PlannedOccurrence[] = [];
  for (const c of candidates) {
    const s = c.slot;
    const when = `${c.date} (${slotLabel(s)})`;
    if (student.status !== "ACTIVE") {
      addIssue(s, "STUDENT_NOT_ACTIVE", c.date, `${student.name} is ${student.status.toLowerCase()}, so classes are not booked.`);
      continue;
    }
    if (!s.teacherId) {
      addIssue(s, "NO_TRAINER", c.date, `No trainer is assigned for ${s.subjectName}. Assign a trainer to book these classes.`);
      continue;
    }
    if (!s.teacherActive) {
      addIssue(s, "TRAINER_INACTIVE", c.date, `${s.teacherName} is inactive. Assign an active trainer for ${s.subjectName}.`);
      continue;
    }
    const clash = findClash(busy, { studentId, teacherId: s.teacherId, start: c.start, end: c.end });
    if (clash) {
      const o = clash.other;
      addIssue(
        s,
        "CONFLICT",
        c.date,
        clash.kind === "student"
          ? `${when}: ${student.name} already has ${o.subjectName} with ${o.teacherName} at that time.`
          : `${when}: ${s.teacherName} is already teaching ${o.studentName} (${o.subjectName}) at that time.`
      );
      continue;
    }

    const length = s.endMinutes - s.startMinutes;
    const forSubject = packages.filter((p) => p.allocations.some((a) => a.subjectId === s.subjectId));
    const started = forSubject.filter((p) => localDateInZone(p.startDate, BUSINESS_TIME_ZONE) <= c.date);
    const valid = started.filter((p) => !p.expiryDate || c.date <= localDateInZone(p.expiryDate, BUSINESS_TIME_ZONE));
    const rightLength = valid.filter((p) => p.durationMinutes === length);
    const chosen = rightLength.find((p) => (pool.get(`${p.id}:${s.subjectId}`) ?? 0) > 0);

    if (!chosen) {
      if (forSubject.length === 0) {
        addIssue(s, "NO_PACKAGE", c.date, `No active package covers ${s.subjectName}. Create or renew a package with ${s.subjectName} classes.`);
      } else if (started.length === 0) {
        addIssue(s, "NOT_STARTED", c.date, `The ${s.subjectName} package starts on ${localDateInZone(forSubject[0].startDate, BUSINESS_TIME_ZONE)}; earlier classes are not booked.`);
      } else if (valid.length === 0) {
        addIssue(s, "EXPIRED", c.date, `Package ${started[started.length - 1].packageNumber} has expired for these dates. Renew the package to book ${s.subjectName}.`);
      } else if (rightLength.length === 0) {
        addIssue(s, "DURATION_MISMATCH", c.date, `This slot is ${length} minutes but the ${s.subjectName} package uses ${valid[0].durationMinutes}-minute classes.`);
      } else {
        addIssue(s, "NO_CREDITS", c.date, `${s.subjectName} has no unreserved classes left in ${rightLength.map((p) => p.packageNumber).join(", ")}. Renew or reallocate credits to book these classes.`);
      }
      continue;
    }

    pool.set(`${chosen.id}:${s.subjectId}`, (pool.get(`${chosen.id}:${s.subjectId}`) ?? 0) - 1);
    busy.push({
      id: `planned:${s.ref}:${c.date}`,
      studentId,
      teacherId: s.teacherId,
      start: c.start,
      end: c.end,
      studentName: student.name,
      teacherName: s.teacherName ?? "",
      subjectName: s.subjectName,
    });
    occurrences.push({
      slotRef: s.ref,
      occurrenceDate: c.date,
      start: c.start,
      end: c.end,
      packageId: chosen.id,
      packageNumber: chosen.packageNumber,
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      teacherId: s.teacherId,
      teacherName: s.teacherName ?? "",
    });
  }

  return {
    timeZone,
    slots,
    removals,
    versioned,
    releasedSessions: released.map((r) => ({
      id: r.id,
      start: r.scheduledStartTimeUtc,
      end: r.scheduledEndTimeUtc,
      subjectName: r.subject.name,
      teacherName: r.teacher.name,
      packageId: r.packageId,
      subjectId: r.subjectId,
    })),
    occurrences,
    issues: [...issueMap.values()],
    summary: {
      added: slots.filter((s) => s.change === "create").length,
      edited: slots.filter((s) => s.change === "update" || s.change === "version").length,
      removed: removals.length,
      unchanged: slots.filter((s) => s.change === "unchanged").length,
      released: released.length,
      toBook: occurrences.length,
    },
  };
}

function slotSnapshot(s: { weekday: number; startMinutes: number; endMinutes: number; timeZone: string; teacherId: string | null; enrolmentId: string }) {
  return {
    enrolmentId: s.enrolmentId,
    teacherId: s.teacherId,
    weekday: dayName(s.weekday),
    start: formatMinutes(s.startMinutes),
    end: formatMinutes(s.endMinutes),
    timeZone: s.timeZone,
  };
}

async function executePlan(tx: Tx, studentId: string, plan: TimetablePlan, user: CurrentUser, now: Date, action: string) {
  // 1. Release future, unattended classes of changed/removed slots.
  if (plan.releasedSessions.length) {
    await tx.session.deleteMany({
      where: {
        id: { in: plan.releasedSessions.map((r) => r.id) },
        status: "SCHEDULED",
        isCreditConsumed: false,
        attendance: { is: null },
      },
    });
  }

  // 2. Removed slots: deactivate when they have history, otherwise delete.
  for (const r of plan.removals) {
    if (r.mode === "deactivate") {
      await tx.timetableSlot.update({
        where: { id: r.slot.id },
        data: { active: false, effectiveUntil: now, updatedByName: user.name },
      });
    } else {
      await tx.timetableSlot.delete({ where: { id: r.slot.id } });
    }
  }

  // 3. Create / update / version slots.
  const idForRef = new Map<string, string>();
  const changes: Record<string, unknown>[] = [];
  for (const s of plan.slots) {
    const data = {
      enrolmentId: s.enrolmentId,
      teacherId: s.teacherId,
      weekday: s.weekday,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      timeZone: s.timeZone,
    };
    if (s.change === "unchanged") {
      idForRef.set(s.ref, s.existingId!);
    } else if (s.change === "create") {
      const created = await tx.timetableSlot.create({
        data: { ...data, effectiveFrom: now, createdByName: user.name, createdByRole: user.role },
      });
      idForRef.set(s.ref, created.id);
      changes.push({ type: "added", slotId: created.id, after: slotSnapshot(data) });
    } else {
      const before = await tx.timetableSlot.findUniqueOrThrow({ where: { id: s.existingId! } });
      if (s.change === "update") {
        await tx.timetableSlot.update({
          where: { id: before.id },
          data: { ...data, effectiveFrom: now, updatedByName: user.name },
        });
        idForRef.set(s.ref, before.id);
        changes.push({ type: "edited", slotId: before.id, before: slotSnapshot(before), after: slotSnapshot(data) });
      } else {
        await tx.timetableSlot.update({
          where: { id: before.id },
          data: { active: false, effectiveUntil: now, updatedByName: user.name },
        });
        const next = await tx.timetableSlot.create({
          data: { ...data, effectiveFrom: now, previousSlotId: before.id, createdByName: user.name, createdByRole: user.role },
        });
        idForRef.set(s.ref, next.id);
        changes.push({ type: "edited (new version)", slotId: next.id, previousSlotId: before.id, before: slotSnapshot(before), after: slotSnapshot(data) });
      }
    }
  }
  for (const r of plan.removals) {
    changes.push({ type: r.mode === "deactivate" ? "deactivated" : "deleted", slotId: r.slot.id, before: slotSnapshot(r.slot) });
  }

  // 4. Book the planned occurrences (the unique key makes a repeat run a no-op).
  for (const o of plan.occurrences) {
    await tx.session.create({
      data: {
        packageId: o.packageId,
        studentId,
        teacherId: o.teacherId,
        subjectId: o.subjectId,
        scheduledStartTimeUtc: o.start,
        scheduledEndTimeUtc: o.end,
        durationMinutes: Math.round((o.end.getTime() - o.start.getTime()) / 60000),
        status: "SCHEDULED",
        isCreditReserved: true,
        isCreditConsumed: false,
        timetableSlotId: idForRef.get(o.slotRef)!,
        occurrenceDate: o.occurrenceDate,
      },
    });
  }

  if (changes.length || plan.occurrences.length || plan.releasedSessions.length) {
    await tx.auditLog.create({
      data: {
        entityType: "TIMETABLE",
        entityId: studentId,
        action,
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          timeZone: plan.timeZone,
          changes,
          releasedClasses: plan.releasedSessions.map((r) => ({ id: r.id, start: r.start, subject: r.subjectName })),
          bookedClasses: plan.occurrences.length,
          notBooked: plan.issues.map((i) => ({ reason: i.reason, subject: i.subjectName, count: i.count })),
        }),
      },
    });
  }
}

/** Runs a timetable change atomically; retries once if a concurrent run booked the same occurrence. */
async function runAtomically(studentId: string, input: { timeZone?: unknown; slots?: unknown } | null, user: CurrentUser, action: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const now = new Date();
          // Serialise timetable changes for this student and bookings against their packages.
          await tx.student.update({ where: { id: studentId }, data: { updatedAt: now } });
          const packageIds = (await tx.studentPackage.findMany({ where: { studentId, status: "ACTIVE" }, select: { id: true } })).map((p) => p.id);
          await lockPackages(tx, packageIds);
          const plan = await buildTimetablePlan(tx, studentId, input, now);
          await executePlan(tx, studentId, plan, user, now, action);
          return plan;
        },
        { timeout: 20000, maxWait: 10000 }
      );
    } catch (err) {
      if (attempt < 2 && uniqueTargetIncludes(err, "occurrenceDate")) continue;
      throw err;
    }
  }
}

export async function previewTimetableChange(studentId: string, input: { timeZone?: unknown; slots?: unknown }) {
  return buildTimetablePlan(prisma, studentId, input);
}

export async function saveTimetable(studentId: string, input: { timeZone?: unknown; slots?: unknown }, user: CurrentUser) {
  return runAtomically(studentId, input, user, "UPDATE_TIMETABLE");
}

/** Books any missing occurrences for the current slots (idempotent). */
export async function generateTimetableOccurrences(studentId: string, user: CurrentUser) {
  return runAtomically(studentId, null, user, "GENERATE_TIMETABLE_CLASSES");
}

/** Retires an enrolment's slots (used when a subject is unenrolled) and releases future classes. */
export async function retireEnrolmentSlots(tx: Tx, enrolmentId: string, user: CurrentUser, now = new Date()) {
  const slots = await tx.timetableSlot.findMany({ where: { enrolmentId, ...currentSlotWhere(now) } });
  if (slots.length === 0) return { retired: 0, released: 0 };
  const released = await tx.session.deleteMany({
    where: {
      timetableSlotId: { in: slots.map((s) => s.id) },
      status: "SCHEDULED",
      isCreditConsumed: false,
      attendance: { is: null },
      scheduledStartTimeUtc: { gte: now },
    },
  });
  await tx.timetableSlot.updateMany({
    where: { id: { in: slots.map((s) => s.id) } },
    data: { active: false, effectiveUntil: now, updatedByName: user.name },
  });
  return { retired: slots.length, released: released.count };
}

/** Everything the student profile needs to show and edit the weekly timetable. */
export async function getTimetableView(studentId: string) {
  const now = new Date();
  const { student, enrolments, currentSlots } = await loadStudentContext(prisma, studentId, now);
  let issues: OccurrenceIssue[] = [];
  let pendingBookings = 0;
  try {
    const dryRun = await buildTimetablePlan(prisma, studentId, null, now);
    issues = dryRun.issues;
    pendingBookings = dryRun.occurrences.length;
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }
  const windowEnd = new Date(now.getTime() + TIMETABLE_WINDOW_DAYS * 24 * 3600 * 1000);
  const upcoming = await prisma.session.findMany({
    where: {
      studentId,
      timetableSlotId: { not: null },
      scheduledStartTimeUtc: { gte: now, lt: windowEnd },
    },
    include: {
      subject: { select: { name: true, color: true } },
      teacher: { select: { name: true } },
      package: { select: { packageNumber: true } },
    },
    orderBy: { scheduledStartTimeUtc: "asc" },
  });
  return {
    timeZone: currentSlots[0]?.timeZone ?? student.timeZone,
    studentTimeZone: student.timeZone,
    studentStatus: student.status,
    windowDays: TIMETABLE_WINDOW_DAYS,
    enrolments: enrolments.map((e) => ({
      id: e.id,
      subjectId: e.subjectId,
      subjectName: e.subject.name,
      subjectColor: e.subject.color,
      teacherId: e.teacherId,
      teacherName: e.teacher?.name ?? null,
      teacherActive: e.teacher?.active ?? false,
    })),
    slots: currentSlots.map((s) => ({
      id: s.id,
      enrolmentId: s.enrolmentId,
      teacherId: s.teacherId,
      weekday: s.weekday,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      timeZone: s.timeZone,
    })),
    issues,
    pendingBookings,
    upcoming: upcoming.map((u) => ({
      id: u.id,
      slotId: u.timetableSlotId,
      start: u.scheduledStartTimeUtc.toISOString(),
      end: u.scheduledEndTimeUtc.toISOString(),
      status: u.status,
      subjectName: u.subject.name,
      subjectColor: u.subject.color,
      teacherName: u.teacher.name,
      packageNumber: u.package.packageNumber,
    })),
  };
}

export type TimetableView = Awaited<ReturnType<typeof getTimetableView>>;

/** JSON-friendly version of a plan for the preview / save responses. */
export function presentPlan(plan: TimetablePlan) {
  return {
    timeZone: plan.timeZone,
    summary: plan.summary,
    released: plan.releasedSessions.map((r) => ({ start: r.start.toISOString(), subjectName: r.subjectName, teacherName: r.teacherName })),
    toBook: plan.occurrences.map((o) => ({
      start: o.start.toISOString(),
      end: o.end.toISOString(),
      date: o.occurrenceDate,
      subjectName: o.subjectName,
      teacherName: o.teacherName,
      packageNumber: o.packageNumber,
    })),
    issues: plan.issues,
    removed: plan.removals.map((r) => ({ subjectName: r.subjectName, mode: r.mode, label: slotLabel(r.slot) })),
    versioned: plan.versioned.length,
  };
}
