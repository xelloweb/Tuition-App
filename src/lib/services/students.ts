import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { FieldCollector, checkInternationalPhone, phonesMatch } from "../validation";
import { BUSINESS_TIME_ZONE, COUNTRY_VALUES, STUDENT_STATUS_VALUES, findCountry } from "../constants";
import { ApiError, notFoundError, relatedRecordError, validationError } from "../api-errors";
import { nextCode, withCodeRetry } from "../codes";
import { cleanDays, storeDays } from "../preferred-days";
import { rememberIdempotentEntity, runIdempotent } from "../idempotency";
import { applyTimetableInTransaction, retireEnrolmentSlots, SlotInput } from "./timetable";
import { convertInTransaction, submissionForDraft } from "./parent-submissions";
import { assignPackageFromExistingPaymentInTx } from "./existing-payment-packages";

type Tx = Prisma.TransactionClient;

export const teacherPublicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  subjects: true,
  active: true,
} satisfies Prisma.TeacherSelect;

/** Shape used by the students directory (and returned after create/update). */
export const studentListInclude = {
  packages: {
    where: { status: "ACTIVE" },
    include: { sessions: { where: { isCreditConsumed: true }, select: { id: true } } },
  },
  enrolments: {
    where: { status: "ACTIVE" },
    include: {
      subject: true,
      teacher: { select: teacherPublicSelect },
      timetableSlots: { where: { active: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  guardian: { select: { id: true, name: true, whatsappNumber: true } },
} satisfies Prisma.StudentInclude;

export interface EnrolmentInput {
  subjectId: string;
  teacherId: string | null;
  notes: string | null;
}

export interface PackageInput {
  name: string;
  totalCredits: number;
  price: number;
  startDate: Date;
  expiryDate: Date | null;
  allocations: { subjectId: string; allocatedCredits: number }[];
  assignFromExistingPayment?: boolean;
  source?: Record<string, unknown>;
}

export interface StudentSlotInput {
  subjectId: string;
  teacherId?: string | null;
  weekday: number;
  start: string;
  end: string;
}

export interface StudentFields {
  name?: string;
  grade?: string;
  board?: string;
  medium?: string;
  guardianId?: string | null;
  guardianName?: string;
  whatsappNumber?: string;
  email?: string | null;
  country?: string;
  timeZone?: string;
  preferredTimings?: string | null;
  /** Stored form of the preferred days ("[1,3,5]"), or null for none. */
  preferredDays?: string | null;
  learningGoals?: string | null;
  coordinatorNotes?: string | null;
  status?: string;
  enrolments?: EnrolmentInput[];
  newPackage?: PackageInput | null;
  draftData?: string | null;
  slots?: StudentSlotInput[];
  /** Admission draft to remove once the student is created (same transaction). */
  draftId?: string | null;
  /** Parent form submission this admission converts (marked Converted in the same transaction). */
  submissionId?: string | null;
}

const MAX_ENROLMENTS = 15;

function optionalId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseEnrolments(v: FieldCollector, value: unknown): EnrolmentInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    v.add("enrolments", "Subjects must be a list.");
    return [];
  }
  if (value.length > MAX_ENROLMENTS) v.add("enrolments", `Add no more than ${MAX_ENROLMENTS} subjects.`);
  const seen = new Set<string>();
  const result: EnrolmentInput[] = [];
  value.forEach((raw, i) => {
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const subjectId = v.id(`enrolments.${i}.subjectId`, row.subjectId, "Subject");
    if (subjectId && seen.has(subjectId)) {
      v.add(`enrolments.${i}.subjectId`, "This subject is already listed. Choose a different subject.");
    }
    seen.add(subjectId);
    result.push({
      subjectId,
      teacherId: optionalId(row.teacherId),
      notes: v.optionalText(`enrolments.${i}.notes`, row.notes, "Enrolment notes", 300),
    });
  });
  return result;
}

function parsePackage(v: FieldCollector, value: unknown, enrolledSubjectIds: string[] | null): PackageInput | null {
  if (value === undefined || value === null || value === false) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    v.add("package", "Package details could not be read.");
    return null;
  }
  const raw = value as Record<string, unknown>;
  const totalCredits = v.integer("package.totalCredits", raw.totalCredits, "Total classes", { min: 1, max: 500 });
  const price = v.integer("package.price", raw.price, "Package price (₹)", { min: 0, max: 10_000_000, fallback: 0 });
  const name =
    v.optionalText("package.name", raw.name, "Package name", 120) ?? `Standard ${totalCredits}-Class Package`;
  const startDate = v.date("package.startDate", raw.startDate, "Start date", false) ?? new Date();
  const expiryDate = v.date("package.expiryDate", raw.expiryDate, "Expiry date", false);
  if (expiryDate && expiryDate <= startDate) {
    v.add("package.expiryDate", "Expiry date must be after the start date.");
  }

  const allocations: PackageInput["allocations"] = [];
  const rawAllocations = Array.isArray(raw.allocations) ? raw.allocations : [];
  const seen = new Set<string>();
  rawAllocations.forEach((item, i) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const subjectId = v.id(`package.allocations.${i}.subjectId`, row.subjectId, "Subject");
    const credits = v.integer(`package.allocations.${i}.allocatedCredits`, row.allocatedCredits, "Classes", {
      min: 0,
      max: 500,
    });
    if (seen.has(subjectId)) v.add(`package.allocations.${i}.subjectId`, "Each subject can be allocated only once.");
    if (enrolledSubjectIds && subjectId && !enrolledSubjectIds.includes(subjectId)) {
      v.add(`package.allocations.${i}.subjectId`, "Allocate classes only to subjects the student is enrolled in.");
    }
    seen.add(subjectId);
    if (credits > 0) allocations.push({ subjectId, allocatedCredits: credits });
  });

  const allocated = allocations.reduce((sum, a) => sum + a.allocatedCredits, 0);
  if (allocated > totalCredits) {
    v.add("package.totalCredits", `Subject allocations (${allocated}) exceed the package total (${totalCredits}).`);
  }
  // If no allocations were provided or explicit sum is 0, auto-distribute across enrolled subjects
  if (allocations.length === 0 && enrolledSubjectIds && enrolledSubjectIds.length > 0 && totalCredits > 0) {
    const baseCredits = Math.floor(totalCredits / enrolledSubjectIds.length);
    let rem = totalCredits % enrolledSubjectIds.length;
    for (const sid of enrolledSubjectIds) {
      const extra = rem > 0 ? 1 : 0;
      if (rem > 0) rem--;
      allocations.push({ subjectId: sid, allocatedCredits: baseCredits + extra });
    }
  }
  const assignFromExistingPayment = Boolean((raw as Record<string, unknown>).assignFromExistingPayment);
  const source = (raw as Record<string, unknown>).source as Record<string, unknown> | undefined;
  return { name, totalCredits, price, startDate, expiryDate, allocations, assignFromExistingPayment, source };
}

/**
 * Validates a student payload. For updates (partial) only supplied fields are
 * checked. Throws a 400 with per-field messages when anything is invalid.
 */
export function parseStudentFields(body: Record<string, unknown>, { partial }: { partial: boolean }): StudentFields {
  const v = new FieldCollector();
  const has = (key: string) => !partial || Object.prototype.hasOwnProperty.call(body, key);
  const f: StudentFields = {};

  // Unfinished admissions are saved as admission drafts, never as placeholder students.
  if (!partial && body.status === "DRAFT") {
    throw validationError("Save unfinished admissions with “Save draft” in the admission form.");
  }
  if (has("name")) f.name = v.requiredText("name", body.name, "Student name", 120);
  if (has("grade")) f.grade = v.requiredText("grade", body.grade, "Class / grade", 60);
  if (has("board")) f.board = v.optionalText("board", body.board, "Board", 80) ?? "CBSE";
  if (has("medium")) f.medium = v.optionalText("medium", body.medium, "Medium", 40) ?? "English";

  f.guardianId = partial ? undefined : optionalId(body.guardianId);
  const linkingExistingGuardian = Boolean(f.guardianId);
  if (has("guardianName") && !linkingExistingGuardian) {
    f.guardianName = v.requiredText("guardianName", body.guardianName, "Parent / guardian name", 120);
  }
  if (has("whatsappNumber") && !linkingExistingGuardian) {
    f.whatsappNumber = v.phone("whatsappNumber", body.whatsappNumber, "WhatsApp number");
  }
  if (has("email")) f.email = v.email("email", body.email, "Email", false);

  if (has("country")) f.country = v.oneOf("country", body.country, COUNTRY_VALUES, "Country", "India");
  // India time only: every student is scheduled in IST.
  if (has("timeZone")) f.timeZone = "Asia/Kolkata";
  if (has("preferredTimings")) f.preferredTimings = v.optionalText("preferredTimings", body.preferredTimings, "Preferred timings", 300);
  if (has("preferredDays")) {
    const days = cleanDays(body.preferredDays);
    if (days === null) v.add("preferredDays", "Choose days from Monday to Sunday.");
    else f.preferredDays = storeDays(days);
  }
  if (has("learningGoals")) f.learningGoals = v.optionalText("learningGoals", body.learningGoals, "Learning goals", 1000);
  if (has("coordinatorNotes")) f.coordinatorNotes = v.optionalText("coordinatorNotes", body.coordinatorNotes, "Coordinator notes", 2000);

  if (body.status !== undefined) {
    // "DRAFT" stays readable for students saved by the old admission form.
    f.status = v.oneOf("status", body.status, partial ? [...STUDENT_STATUS_VALUES, "DRAFT"] : [...STUDENT_STATUS_VALUES], "Status");
  }
  if (partial && has("draftData")) f.draftData = typeof body.draftData === "string" ? body.draftData : null;
  if (!partial) f.draftId = optionalId(body.draftId);
  if (!partial) f.submissionId = optionalId(body.submissionId);

  if (has("enrolments") && body.enrolments !== undefined) f.enrolments = parseEnrolments(v, body.enrolments);

  // Weekly slots: shape only here; times, overlaps and trainer clashes are
  // checked by the timetable plan inside the save transaction.
  if (body.slots !== undefined) {
    if (!Array.isArray(body.slots)) v.add("slots", "Weekly slots must be a list.");
    else if (body.slots.length > 100) v.add("slots", "A timetable can have up to 100 weekly slots.");
    else {
      f.slots = (body.slots as unknown[]).map((raw) => {
        const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        return {
          subjectId: typeof r.subjectId === "string" ? r.subjectId : "",
          teacherId: typeof r.teacherId === "string" && r.teacherId ? r.teacherId : null,
          weekday: Number(r.weekday),
          start: typeof r.start === "string" ? r.start : "",
          end: typeof r.end === "string" ? r.end : "",
        };
      });
    }
  }

  const packageBody = partial ? (body.newPackage ?? body.initialPackage) : body.initialPackage;
  const enrolledIds = f.enrolments ? f.enrolments.map((e) => e.subjectId) : null;
  f.newPackage = parsePackage(v, packageBody, partial && !f.enrolments ? null : enrolledIds ?? []);

  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);
  return f;
}

async function assertSubjectsExist(tx: Tx, enrolments: EnrolmentInput[]) {
  const ids = [...new Set(enrolments.map((e) => e.subjectId))];
  const found = new Set((await tx.subject.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((s) => s.id));
  const fieldErrors: Record<string, string> = {};
  enrolments.forEach((e, i) => {
    if (!found.has(e.subjectId)) fieldErrors[`enrolments.${i}.subjectId`] = "This subject no longer exists. Choose another subject.";
  });
  if (Object.keys(fieldErrors).length) {
    throw relatedRecordError("One or more selected subjects no longer exist. Refresh the page and choose again.", fieldErrors);
  }
}

/** Trainers must exist and be active unless the enrolment already had that trainer. */
async function assertTeachersAssignable(tx: Tx, enrolments: EnrolmentInput[], existing: Map<string, string | null> = new Map()) {
  const ids = [...new Set(enrolments.map((e) => e.teacherId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  const teachers = new Map(
    (await tx.teacher.findMany({ where: { id: { in: ids } }, select: { id: true, active: true } })).map((t) => [t.id, t])
  );
  const fieldErrors: Record<string, string> = {};
  enrolments.forEach((e, i) => {
    if (!e.teacherId) return;
    const teacher = teachers.get(e.teacherId);
    const unchanged = existing.get(e.subjectId) === e.teacherId;
    if (!teacher) {
      fieldErrors[`enrolments.${i}.teacherId`] = "This trainer no longer exists. Choose another trainer or leave it unassigned.";
    } else if (!teacher.active && !unchanged) {
      fieldErrors[`enrolments.${i}.teacherId`] = "This trainer is inactive. Choose an active trainer or leave it unassigned.";
    }
  });
  if (Object.keys(fieldErrors).length) {
    throw relatedRecordError("A selected trainer is no longer available. Refresh the trainer list and choose again.", fieldErrors);
  }
}

/** Gives a package its classes per subject, with one opening ledger entry per subject. */
export async function addPackageAllocations(
  tx: Tx,
  packageId: string,
  allocations: PackageInput["allocations"],
  user: CurrentUser,
  reason = "Initial package purchase allocation"
) {
  for (const alloc of allocations) {
    await tx.subjectAllocation.create({
      data: { packageId, subjectId: alloc.subjectId, allocatedCredits: alloc.allocatedCredits },
    });
    await tx.creditLedger.create({
      data: {
        packageId,
        subjectId: alloc.subjectId,
        eventType: "PURCHASE_INITIAL",
        creditsDelta: alloc.allocatedCredits,
        resultingRemaining: alloc.allocatedCredits,
        reason,
        actorRole: user.role,
        actorName: user.name,
      },
    });
  }
}

/**
 * Creates a package with subject allocations, opening ledger entries and (if
 * priced) an unpaid invoice: a new purchase. `createInvoice: false` is for
 * packages paid with money already received (no new fee).
 */
export async function createPackageForStudent(
  tx: Tx,
  studentId: string,
  input: PackageInput,
  user: CurrentUser,
  { createInvoice = true, ledgerReason }: { createInvoice?: boolean; ledgerReason?: string } = {}
) {
  const packageNumber = await nextCode(tx, "package");
  const pkg = await tx.studentPackage.create({
    data: {
      packageNumber,
      studentId,
      name: input.name,
      totalCredits: input.totalCredits,
      durationMinutes: 60,
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      price: input.price,
      currency: "INR",
      status: "ACTIVE",
      cancellationNoticeHours: 4,
      noShowDeductCredit: true,
    },
  });

  await addPackageAllocations(tx, pkg.id, input.allocations, user, ledgerReason);

  let invoiceNumber: string | null = null;
  if (createInvoice && input.price > 0) {
    invoiceNumber = await nextCode(tx, "invoice");
    await tx.invoice.create({
      data: {
        invoiceNumber,
        studentId,
        packageId: pkg.id,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        subtotal: input.price,
        discount: 0,
        totalAmount: input.price,
        paidAmount: 0,
        balanceDue: input.price,
        currency: "INR",
        status: "UNPAID",
        items: { create: [{ description: pkg.name, quantity: 1, unitPrice: input.price, amount: input.price }] },
      },
    });
  }
  return { packageId: pkg.id, packageNumber, invoiceNumber };
}

/** Admission summary for the confirmation message and the dry-run check. */
export interface AdmissionBooking {
  weeklySlots: number;
  bookedClasses: number;
  notBooked: string[];
}

class DryRunComplete extends Error {
  constructor(readonly booking: AdmissionBooking | null) {
    super("dry run");
  }
}

/**
 * Creates a student with enrolments, an optional package and weekly slots in
 * one transaction. With `dryRun`, every check runs and the transaction is
 * rolled back, so the admission form can show problems before confirming.
 */
async function saveAdmission(fields: StudentFields, user: CurrentUser, idempotencyKey: string | null, dryRun: boolean) {
  const enrolments = fields.enrolments ?? [];
  let booking: AdmissionBooking | null = null;
  const save = () =>
      withCodeRetry(["student", "package", "invoice"], () =>
        prisma.$transaction(async (tx) => {
          await assertSubjectsExist(tx, enrolments);
          await assertTeachersAssignable(tx, enrolments);

          // Guardians are only shared when the coordinator explicitly links one;
          // a matching phone number alone never merges families.
          let guardian;
          if (fields.guardianId) {
            guardian = await tx.guardian.findUnique({ where: { id: fields.guardianId } });
            if (!guardian) {
              throw relatedRecordError("The selected guardian no longer exists. Search again or add a new guardian.", {
                guardianId: "This guardian record no longer exists.",
              });
            }
          } else {
            guardian = await tx.guardian.create({
              data: {
                name: fields.guardianName!,
                whatsappNumber: fields.whatsappNumber!,
                email: fields.email ?? null,
                country: fields.country ?? "India",
                timeZone: fields.timeZone ?? "Asia/Kolkata",
              },
            });
          }

          const studentCode = await nextCode(tx, "student");
          const student = await tx.student.create({
            data: {
              studentCode,
              name: fields.name!,
              grade: fields.grade!,
              board: fields.board ?? "CBSE",
              medium: fields.medium ?? "English",
              guardianId: guardian.id,
              guardianName: guardian.name,
              whatsappNumber: guardian.whatsappNumber,
              email: fields.email ?? null,
              country: fields.country ?? "India",
              timeZone: fields.timeZone ?? "Asia/Kolkata",
              preferredTimings: fields.preferredTimings ?? null,
              preferredDays: fields.preferredDays ?? null,
              learningGoals: fields.learningGoals ?? null,
              coordinatorNotes: fields.coordinatorNotes ?? null,
              status: fields.status ?? "ACTIVE",
              draftData: fields.draftData ?? null,
            },
          });

          const createdEnrolments: { id: string; subjectId: string }[] = [];
          for (const enr of enrolments) {
            createdEnrolments.push(await tx.subjectEnrollment.create({
              data: {
                studentId: student.id,
                subjectId: enr.subjectId,
                teacherId: enr.teacherId,
                status: "ACTIVE",
                notes: enr.notes,
              },
            }));
          }
          
          const pkg = fields.newPackage ? await createPackageForStudent(tx, student.id, fields.newPackage, user) : null;

          // Weekly slots go through the timetable plan (times, overlaps, trainer
          // clashes, credit-aware booking) inside this transaction, so an admission
          // is saved complete or not at all. Per-slot errors use the payload index.
          if (fields.slots?.length) {
            const plan = await applyTimetableInTransaction(
              tx,
              student.id,
              {
                timeZone: BUSINESS_TIME_ZONE,
                slots: fields.slots.map((slot) => ({
                  enrolmentId: createdEnrolments.find((e) => e.subjectId === slot.subjectId)?.id,
                  teacherId: slot.teacherId ?? null,
                  weekday: slot.weekday,
                  start: slot.start,
                  end: slot.end,
                })),
              },
              user
            );
            booking = { weeklySlots: plan.slots.length, bookedClasses: plan.occurrences.length, notBooked: plan.issues.map((i) => i.message) };
          }

          // A parent submission is converted exactly once, together with the admission.
          let submissionId = fields.submissionId ?? null;
          if (fields.draftId) {
            const linked = await submissionForDraft(tx, fields.draftId);
            if (linked && submissionId && linked.id !== submissionId) {
              throw validationError("This draft belongs to a different parent submission. Refresh the page and try again.");
            }
            submissionId = linked?.id ?? submissionId;
          }
          if (submissionId) await convertInTransaction(tx, submissionId, student.id, user);

          if (fields.draftId) await tx.admissionDraft.deleteMany({ where: { id: fields.draftId } });

          await tx.auditLog.create({
            data: {
              entityType: "STUDENT",
              entityId: student.id,
              action: "CREATE_STUDENT",
              actorRole: user.role,
              actorName: user.name,
              details: JSON.stringify({
                studentCode,
                name: student.name,
                status: student.status,
                guardianId: guardian.id,
                linkedExistingGuardian: Boolean(fields.guardianId),
                subjects: enrolments.length,
                unassignedSubjects: enrolments.filter((e) => !e.teacherId).length,
                packageNumber: pkg?.packageNumber ?? null,
                invoiceNumber: pkg?.invoiceNumber ?? null,
                fromParentSubmission: submissionId,
              }),
            },
          });
          if (dryRun) throw new DryRunComplete(booking);
          await rememberIdempotentEntity(tx, "CREATE_STUDENT", idempotencyKey, student.id);

          return tx.student.findUniqueOrThrow({ where: { id: student.id }, include: studentListInclude });
        }, { timeout: 20000, maxWait: 10000 })
      );

  if (dryRun) {
    try {
      await save();
    } catch (err) {
      if (err instanceof DryRunComplete) return { result: null, replayed: false, booking: err.booking };
      throw err;
    }
    throw new Error("Dry run did not complete.");
  }
  const { result, replayed } = await runIdempotent(
    "CREATE_STUDENT",
    idempotencyKey,
    save,
    (id) => prisma.student.findUnique({ where: { id }, include: studentListInclude })
  );
  return { result, replayed, booking: replayed ? null : booking };
}

/** Saves an admission (student, enrolments, package, weekly slots and first bookings) atomically. */
export async function createStudent(fields: StudentFields, user: CurrentUser, idempotencyKey: string | null) {
  const { result, replayed, booking } = await saveAdmission(fields, user, idempotencyKey, false);
  return { result: result!, replayed, booking };
}

/** Runs every admission check and rolls back: nothing is saved. */
export async function checkAdmission(fields: StudentFields, user: CurrentUser) {
  const { booking } = await saveAdmission(fields, user, null, true);
  return { booking };
}

export async function updateStudent(id: string, f: StudentFields, user: CurrentUser) {
  const result = await withCodeRetry(["package", "invoice"], () =>
    prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id }, include: { enrolments: true } });
      if (!student) throw notFoundError("This student no longer exists. Refresh the page.");

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const scalarKeys = [
        "name", "grade", "board", "medium", "email", "country", "timeZone",
        "preferredTimings", "preferredDays", "learningGoals", "coordinatorNotes", "status", "draftData"
      ] as const;
      const data: Prisma.StudentUpdateInput = {};
      for (const key of scalarKeys) {
        if (f[key] !== undefined && f[key] !== student[key]) {
          changes[key] = { from: key === "draftData" ? Boolean(student.draftData) : student[key], to: key === "draftData" ? Boolean(f.draftData) : f[key] };
          (data as Record<string, unknown>)[key] = f[key];
        }
      }

      // Guardian name / number belong to the guardian, who may have several
      // children: update the guardian and every linked sibling together.
      const guardianChanged =
        (f.guardianName !== undefined && f.guardianName !== student.guardianName) ||
        (f.whatsappNumber !== undefined && f.whatsappNumber !== student.whatsappNumber);
      let siblingsUpdated = 0;
      if (guardianChanged) {
        const guardianName = f.guardianName ?? student.guardianName;
        const whatsappNumber = f.whatsappNumber ?? student.whatsappNumber;
        changes.guardian = {
          from: { name: student.guardianName, whatsappNumber: student.whatsappNumber },
          to: { name: guardianName, whatsappNumber },
        };
        if (student.guardianId) {
          await tx.guardian.update({ where: { id: student.guardianId }, data: { name: guardianName, whatsappNumber } });
          const result = await tx.student.updateMany({
            where: { guardianId: student.guardianId },
            data: { guardianName, whatsappNumber },
          });
          siblingsUpdated = result.count - 1;
        } else {
          Object.assign(data, { guardianName, whatsappNumber });
        }
      }

      if (Object.keys(data).length) await tx.student.update({ where: { id }, data });

      if (f.enrolments) {
        await assertSubjectsExist(tx, f.enrolments);
        const existingBySubject = new Map(student.enrolments.map((e) => [e.subjectId, e]));
        await assertTeachersAssignable(
          tx,
          f.enrolments,
          new Map(student.enrolments.map((e) => [e.subjectId, e.teacherId]))
        );
        const keep = new Set<string>();
        const enrolmentChanges: string[] = [];
        for (const enr of f.enrolments) {
          keep.add(enr.subjectId);
          const existing = existingBySubject.get(enr.subjectId);
          if (existing) {
            if (existing.teacherId !== enr.teacherId || existing.status !== "ACTIVE") {
              const previousTeacherId = existing.teacherId;
              await tx.subjectEnrollment.update({
                where: { id: existing.id },
                data: { teacherId: enr.teacherId, status: "ACTIVE" },
              });
              enrolmentChanges.push(`reassigned ${enr.subjectId}`);

              if (previousTeacherId !== enr.teacherId) {
                const now = new Date();
                const slots = await tx.timetableSlot.findMany({
                  where: { enrolmentId: existing.id, active: true },
                });
                if (slots.length > 0) {
                  await tx.timetableSlot.updateMany({
                    where: { enrolmentId: existing.id, active: true },
                    data: { teacherId: enr.teacherId, updatedByName: user.name },
                  });
                  await tx.session.deleteMany({
                    where: {
                      timetableSlotId: { in: slots.map((s) => s.id) },
                      status: "SCHEDULED",
                      isCreditConsumed: false,
                      attendance: { is: null },
                      scheduledStartTimeUtc: { gte: now },
                    },
                  });
                }
              }
            }
          } else {
            await tx.subjectEnrollment.create({
              data: { studentId: id, subjectId: enr.subjectId, teacherId: enr.teacherId, status: "ACTIVE", notes: enr.notes },
            });
            enrolmentChanges.push(`added ${enr.subjectId}`);
          }
        }
        for (const existing of student.enrolments) {
          if (keep.has(existing.subjectId) || existing.status !== "ACTIVE") continue;
          // Keep enrolments that weekly slots point at (as inactive) so class history stays linked.
          if ((await tx.timetableSlot.count({ where: { enrolmentId: existing.id } })) > 0) {
            await retireEnrolmentSlots(tx, existing.id, user);
            await tx.subjectEnrollment.update({ where: { id: existing.id }, data: { status: "INACTIVE" } });
          } else {
            await tx.subjectEnrollment.delete({ where: { id: existing.id } });
          }
          enrolmentChanges.push(`removed ${existing.subjectId}`);
        }
        if (enrolmentChanges.length) changes.enrolments = { from: null, to: enrolmentChanges };
        
        // Weekly slots are edited in the student's timetable editor. The only
        // exception is confirming a draft saved by the old admission form.
      }

      const confirmingLegacyDraft = student.status === "DRAFT" && f.status === "ACTIVE";
      let legacyBooking: AdmissionBooking | null = null;

      let pkg = null;
      if (f.newPackage) {
        if (f.newPackage.assignFromExistingPayment) {
          const assignRes = await assignPackageFromExistingPaymentInTx(
            tx,
            id,
            {
              source: f.newPackage.source,
              name: f.newPackage.name,
              totalCredits: f.newPackage.totalCredits,
              price: f.newPackage.price,
              startDate: f.newPackage.startDate ? f.newPackage.startDate.toISOString().slice(0, 10) : undefined,
              expiryDate: f.newPackage.expiryDate ? f.newPackage.expiryDate.toISOString().slice(0, 10) : undefined,
              allocations: f.newPackage.allocations,
            },
            user
          );
          pkg = { packageId: assignRes.packageId, packageNumber: assignRes.packageNumber, invoiceNumber: assignRes.invoiceNumber };
          changes.newPackage = { from: null, to: pkg };
        } else {
          const enrolled = new Set(
            (await tx.subjectEnrollment.findMany({ where: { studentId: id }, select: { subjectId: true } })).map((e) => e.subjectId)
          );
          const fieldErrors: Record<string, string> = {};
          f.newPackage.allocations.forEach((a, i) => {
            if (!enrolled.has(a.subjectId)) {
              fieldErrors[`package.allocations.${i}.subjectId`] = "Allocate classes only to subjects the student is enrolled in.";
            }
          });
          if (Object.keys(fieldErrors).length) throw validationError("Please correct the package allocations.", fieldErrors);
          pkg = await createPackageForStudent(tx, id, f.newPackage, user);
          changes.newPackage = { from: null, to: pkg };
        }
      }

      const shouldApplySlots = confirmingLegacyDraft ? Boolean(f.slots?.length) : f.slots !== undefined;
      if (shouldApplySlots) {
        const current = await tx.subjectEnrollment.findMany({ where: { studentId: id, status: "ACTIVE" }, select: { id: true, subjectId: true } });
        const plan = await applyTimetableInTransaction(
          tx,
          id,
          {
            timeZone: BUSINESS_TIME_ZONE,
            slots: (f.slots ?? []).map((slot) => ({
              enrolmentId: current.find((e) => e.subjectId === slot.subjectId)?.id,
              teacherId: slot.teacherId ?? null,
              weekday: slot.weekday,
              start: slot.start,
              end: slot.end,
            })),
          },
          user,
          confirmingLegacyDraft ? "ADMISSION_TIMETABLE" : "UPDATE_TIMETABLE"
        );
        legacyBooking = { weeklySlots: plan.slots.length, bookedClasses: plan.occurrences.length, notBooked: plan.issues.map((i) => i.message) };
        changes.timetable = { from: null, to: legacyBooking };
      }

      await tx.auditLog.create({
        data: {
          entityType: "STUDENT",
          entityId: id,
          action: f.status === "WITHDRAWN" && student.status !== "WITHDRAWN" ? "ARCHIVE_STUDENT" : "UPDATE_STUDENT",
          actorRole: user.role,
          actorName: user.name,
          details: JSON.stringify({ studentCode: student.studentCode, changes, siblingsUpdated }),
        },
      });

      const updated = await tx.student.findUniqueOrThrow({ where: { id }, include: studentListInclude });
      return { student: updated, siblingsUpdated, packageNumber: pkg?.packageNumber ?? null, booking: legacyBooking };
    }, { timeout: 20000, maxWait: 10000 })
  );

  if (f.newPackage || f.enrolments) {
    try {
      const { generateTimetableOccurrences } = await import("./timetable");
      await generateTimetableOccurrences(id, user);
    } catch (e) {
      console.error("Auto booking timetable classes after update failed:", e);
    }
  }

  return result;
}

export async function deleteStudent(id: string, user: CurrentUser) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          packages: true, sessions: true, invoices: true, payments: true,
          followUps: true, progressReports: true, assessments: true, parentConcerns: true,
        },
      },
    },
  });
  if (!student) throw notFoundError("This student no longer exists. Refresh the page.");

  const c = student._count;
  const weeklySlots = await prisma.timetableSlot.count({ where: { enrolment: { studentId: id } } });
  const historyCount = Object.values(c).reduce((a, b) => a + b, 0) + weeklySlots;
  if (historyCount > 0) {
    throw new ApiError(
      409,
      "HAS_HISTORY",
      `${student.name} has ${c.packages} package(s), ${c.sessions} session(s), ${c.invoices} invoice(s), ${c.payments} payment(s) and ${weeklySlots} weekly timetable slot(s). Archive the student instead (status: Withdrawn) so academic and financial records are kept.`,
      { details: { ...c, weeklySlots } }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.student.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        entityType: "STUDENT",
        entityId: id,
        action: "DELETE_STUDENT",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ studentCode: student.studentCode, name: student.name, guardianId: student.guardianId }),
      },
    });
  });
  return { name: student.name, studentCode: student.studentCode };
}

/** Guardians whose WhatsApp number matches, so the coordinator can link siblings explicitly. */
export async function findGuardiansByPhone(rawPhone: string) {
  const check = checkInternationalPhone(rawPhone);
  if (!check.ok) return [];
  const guardians = await prisma.guardian.findMany({
    select: {
      id: true, name: true, whatsappNumber: true, country: true, timeZone: true,
      students: { select: { id: true, name: true, studentCode: true, status: true } },
    },
  });
  return guardians.filter((g) => phonesMatch(g.whatsappNumber, check.canonical));
}

export async function listStudentsFor(user: CurrentUser) {
  if (user.role === "TEACHER") {
    const teacherId = user.teacherId ?? "__none__";
    return prisma.student.findMany({
      where: {
        enrolments: { some: { teacherId, status: "ACTIVE" } },
      },
      include: {
        ...studentListInclude,
        packages: false,
        enrolments: {
          where: { teacherId, status: "ACTIVE" },
          include: {
            subject: true,
            teacher: { select: teacherPublicSelect },
            timetableSlots: { where: { active: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  return prisma.student.findMany({ include: studentListInclude, orderBy: { createdAt: "desc" } });
}
