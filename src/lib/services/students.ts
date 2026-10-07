import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { FieldCollector, checkInternationalPhone, phonesMatch } from "../validation";
import { COUNTRY_VALUES, STUDENT_STATUS_VALUES, findCountry } from "../constants";
import { ApiError, notFoundError, relatedRecordError, validationError } from "../api-errors";
import { nextCode, withCodeRetry } from "../codes";
import { rememberIdempotentEntity, runIdempotent } from "../idempotency";
import { retireEnrolmentSlots, SlotInput } from "./timetable";

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
    include: { subject: true, teacher: { select: teacherPublicSelect } },
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
  learningGoals?: string | null;
  coordinatorNotes?: string | null;
  status?: string;
  enrolments?: EnrolmentInput[];
  newPackage?: PackageInput | null;
  draftData?: string | null;
  slots?: StudentSlotInput[];
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
  return { name, totalCredits, price, startDate, expiryDate, allocations };
}

/**
 * Validates a student payload. For updates (partial) only supplied fields are
 * checked. Throws a 400 with per-field messages when anything is invalid.
 */
export function parseStudentFields(body: Record<string, unknown>, { partial }: { partial: boolean }): StudentFields {
  const v = new FieldCollector();
  const has = (key: string) => !partial || Object.prototype.hasOwnProperty.call(body, key);
  const f: StudentFields = {};

  const isDraft = body.status === "DRAFT";

  if (has("name")) {
    f.name = isDraft 
      ? v.optionalText("name", body.name, "Student name", 120) || "Draft Student"
      : v.requiredText("name", body.name, "Student name", 120);
  }
  if (has("grade")) {
    f.grade = isDraft
      ? v.optionalText("grade", body.grade, "Class / grade", 60) || "TBD"
      : v.requiredText("grade", body.grade, "Class / grade", 60);
  }
  if (has("board")) f.board = v.optionalText("board", body.board, "Board", 80) ?? "CBSE";
  if (has("medium")) f.medium = v.optionalText("medium", body.medium, "Medium", 40) ?? "English";

  f.guardianId = partial ? undefined : optionalId(body.guardianId);
  const linkingExistingGuardian = Boolean(f.guardianId);
  if (has("guardianName") && !linkingExistingGuardian) {
    f.guardianName = isDraft
      ? v.optionalText("guardianName", body.guardianName, "Parent / guardian name", 120) || "TBD"
      : v.requiredText("guardianName", body.guardianName, "Parent / guardian name", 120);
  }
  if (has("whatsappNumber") && !linkingExistingGuardian) {
    if (isDraft && !body.whatsappNumber) {
      f.whatsappNumber = "+910000000000"; // Dummy for draft if missing
    } else {
      f.whatsappNumber = v.phone("whatsappNumber", body.whatsappNumber, "WhatsApp number");
    }
  }
  if (has("email")) f.email = v.email("email", body.email, "Email", false);

  if (has("country")) f.country = v.oneOf("country", body.country, COUNTRY_VALUES, "Country", "India");
  if (has("timeZone")) {
    f.timeZone = v.timeZone("timeZone", body.timeZone, findCountry(f.country)?.timeZone ?? "Asia/Kolkata");
  }
  if (has("preferredTimings")) f.preferredTimings = v.optionalText("preferredTimings", body.preferredTimings, "Preferred timings", 300);
  if (has("learningGoals")) f.learningGoals = v.optionalText("learningGoals", body.learningGoals, "Learning goals", 1000);
  if (has("coordinatorNotes")) f.coordinatorNotes = v.optionalText("coordinatorNotes", body.coordinatorNotes, "Coordinator notes", 2000);
  
  if (body.status !== undefined) {
    f.status = v.oneOf("status", body.status, [...STUDENT_STATUS_VALUES, "DRAFT"], "Status");
  }
  
  if (has("draftData")) {
    f.draftData = typeof body.draftData === "string" ? body.draftData : null;
  }

  if (has("enrolments") && body.enrolments !== undefined && !isDraft) f.enrolments = parseEnrolments(v, body.enrolments);
  
  if (has("slots") && body.slots !== undefined && !isDraft) {
    f.slots = Array.isArray(body.slots) ? (body.slots as StudentSlotInput[]) : [];
  }

  const packageBody = partial ? (body.newPackage ?? body.initialPackage) : body.initialPackage;
  const enrolledIds = f.enrolments ? f.enrolments.map((e) => e.subjectId) : null;
  if (!isDraft) {
    f.newPackage = parsePackage(v, packageBody, partial && !f.enrolments ? null : enrolledIds ?? []);
  }

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

/** Creates a package with subject allocations, opening ledger entries and (if priced) an invoice. */
export async function createPackageForStudent(tx: Tx, studentId: string, input: PackageInput, user: CurrentUser) {
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

  for (const alloc of input.allocations) {
    await tx.subjectAllocation.create({
      data: { packageId: pkg.id, subjectId: alloc.subjectId, allocatedCredits: alloc.allocatedCredits },
    });
    await tx.creditLedger.create({
      data: {
        packageId: pkg.id,
        subjectId: alloc.subjectId,
        eventType: "PURCHASE_INITIAL",
        creditsDelta: alloc.allocatedCredits,
        resultingRemaining: alloc.allocatedCredits,
        reason: "Initial package purchase allocation",
        actorRole: user.role,
        actorName: user.name,
      },
    });
  }

  let invoiceNumber: string | null = null;
  if (input.price > 0) {
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

export async function createStudent(fields: StudentFields, user: CurrentUser, idempotencyKey: string | null) {
  const enrolments = fields.enrolments ?? [];
  return runIdempotent(
    "CREATE_STUDENT",
    idempotencyKey,
    () =>
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
              learningGoals: fields.learningGoals ?? null,
              coordinatorNotes: fields.coordinatorNotes ?? null,
              status: fields.status ?? "ACTIVE",
              draftData: fields.draftData ?? null,
            },
          });

          const createdEnrolments = [];
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
          
          if (fields.slots) {
            for (const s of fields.slots) {
              const enr = createdEnrolments.find(e => e.subjectId === s.subjectId);
              if (!enr) continue;
              
              const startParts = s.start.split(":");
              const endParts = s.end.split(":");
              const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
              const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
              
              await tx.timetableSlot.create({
                data: {
                  enrolmentId: enr.id,
                  teacherId: s.teacherId,
                  weekday: s.weekday,
                  startMinutes,
                  endMinutes,
                  timeZone: "Asia/Kolkata",
                  effectiveFrom: new Date(),
                  createdByName: user.name,
                  createdByRole: user.role,
                  active: true
                }
              });
            }
          }

          const pkg = fields.newPackage ? await createPackageForStudent(tx, student.id, fields.newPackage, user) : null;

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
              }),
            },
          });
          await rememberIdempotentEntity(tx, "CREATE_STUDENT", idempotencyKey, student.id);

          return tx.student.findUniqueOrThrow({ where: { id: student.id }, include: studentListInclude });
        })
      ),
    (id) => prisma.student.findUnique({ where: { id }, include: studentListInclude })
  );
}

export async function updateStudent(id: string, f: StudentFields, user: CurrentUser) {
  return withCodeRetry(["package", "invoice"], () =>
    prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id }, include: { enrolments: true } });
      if (!student) throw notFoundError("This student no longer exists. Refresh the page.");

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      const scalarKeys = [
        "name", "grade", "board", "medium", "email", "country", "timeZone",
        "preferredTimings", "learningGoals", "coordinatorNotes", "status", "draftData"
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
              await tx.subjectEnrollment.update({
                where: { id: existing.id },
                data: { teacherId: enr.teacherId, status: "ACTIVE" },
              });
              enrolmentChanges.push(`reassigned ${enr.subjectId}`);
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
        
        // Handle slot additions during update (e.g. confirming a draft)
        if (f.slots) {
          const currentEnrolments = await tx.subjectEnrollment.findMany({ where: { studentId: id, status: "ACTIVE" } });
          const currentSlots = await tx.timetableSlot.findMany({ where: { enrolment: { studentId: id }, active: true } });
          
          for (const s of f.slots) {
            const enr = currentEnrolments.find(e => e.subjectId === s.subjectId);
            if (!enr) continue;
            
            const startParts = s.start.split(":");
            const endParts = s.end.split(":");
            const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
            
            // Check if exact slot exists
            const exists = currentSlots.some(cs => 
              cs.enrolmentId === enr.id && cs.weekday === Number(s.weekday) && cs.startMinutes === startMinutes
            );
            if (!exists) {
              await tx.timetableSlot.create({
                data: {
                  enrolmentId: enr.id,
                  teacherId: s.teacherId,
                  weekday: Number(s.weekday),
                  startMinutes,
                  endMinutes,
                  timeZone: "Asia/Kolkata",
                  effectiveFrom: new Date(),
                  createdByName: user.name,
                  createdByRole: user.role,
                  active: true
                }
              });
            }
          }
        }
      }

      let pkg = null;
      if (f.newPackage) {
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
      return { student: updated, siblingsUpdated, packageNumber: pkg?.packageNumber ?? null };
    })
  );
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
  const where: Prisma.StudentWhereInput =
    user.role === "TEACHER"
      ? {
          OR: [
            { enrolments: { some: { teacherId: user.teacherId ?? "__none__" } } },
            { sessions: { some: { teacherId: user.teacherId ?? "__none__" } } },
          ],
        }
      : {};
  return prisma.student.findMany({ where, include: studentListInclude, orderBy: { createdAt: "desc" } });
}
