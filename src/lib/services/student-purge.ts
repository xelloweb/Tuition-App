/**
 * Owner-only: permanently delete an archived student and everything that
 * belongs only to them, after the owner has downloaded a backup.
 *
 * Deleted: the student, their parent record (when no brother or sister uses
 * it), subjects and trainer allocations, weekly timetable, packages, every
 * class (booked or attended) with its attendance and credit history, the
 * trainer pay still pending for those classes, invoices, payments, follow-ups,
 * progress notes, assessments, parent concerns and the parent forms converted
 * into or linked to this student. Their WhatsApp number is then free.
 * Trainer pay for their classes that is not yet in a pay run goes with the
 * classes (it is no longer owed through the app).
 * Kept: the audit log (with one new entry for the deletion), every other
 * student, trainers and their accounts.
 * Refused when: the student is not archived, trainer pay for one of their
 * classes is already in a pay run or paid, or a record is shared with another
 * student (a payment, invoice or class).
 *
 * The backup holds every deleted row; restoreStudentBackup puts them back.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { conflictError, forbiddenError, notFoundError, validationError } from "../api-errors";

type Db = PrismaClient | Prisma.TransactionClient;
type Row = Record<string, unknown>;

/** Restore order (parents first); deletion runs in reverse. */
export const PURGE_TABLES = [
  "Guardian",
  "Student",
  "SubjectEnrollment",
  "StudentPackage",
  "SubjectAllocation",
  "TimetableSlot",
  "Session",
  "AttendanceRecord",
  "AttendanceRevision",
  "AttendanceCorrectionRequest",
  "CreditLedger",
  "PayoutItem",
  "Invoice",
  "InvoiceLineItem",
  "InvoiceInstalment",
  "Payment",
  "PaymentAllocation",
  "FollowUp",
  "StudentProgress",
  "Assessment",
  "ParentConcern",
  "AdmissionDraft",
  "ParentSubmission",
  "ParentSubmissionNote",
  "IdempotencyKey",
] as const;
export type PurgeTable = (typeof PURGE_TABLES)[number];
export type PurgeGraph = Record<PurgeTable, Row[]>;

export interface StudentBackup {
  format: "xello-student-backup";
  version: 1;
  createdAt: string;
  createdBy: string;
  student: { id: string; studentCode: string; name: string };
  tables: PurgeGraph;
}

export interface StudentPurgePreview {
  student: {
    id: string;
    studentCode: string;
    name: string;
    grade: string;
    status: string;
    guardianName: string;
    whatsappNumber: string;
    email: string | null;
    createdAt: string;
  };
  /** The parent record goes too unless a brother or sister still uses it. */
  guardian: { removed: boolean; otherChildren: { name: string; studentCode: string }[] };
  subjects: { subjectName: string; teacherName: string | null }[];
  weeklySlots: number;
  packages: { packageNumber: string; name: string; totalCredits: number; status: string }[];
  classes: { attended: number; upcoming: number; other: number };
  invoices: { invoiceNumber: string; totalAmount: number; paidAmount: number; status: string }[];
  payments: { paymentNumber: string; amount: number; receivedDate: string; paymentMethod: string }[];
  /** Pay for classes taught to this student that is not yet in a pay run: removed with the classes. */
  trainerPayPending: { classes: number; amount: number; trainers: string[] };
  other: { followUps: number; progressNotes: number; assessments: number; parentConcerns: number; parentForms: number };
  totalRecords: number;
  blockers: string[];
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const delegate = (db: Db, table: PurgeTable) =>
  (db as unknown as Record<string, { deleteMany: (a: unknown) => Promise<{ count: number }>; createMany: (a: unknown) => Promise<{ count: number }>; findMany: (a: unknown) => Promise<Row[]> }>)[lowerFirst(table)];
const modelOf = (table: PurgeTable) => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === table);
  if (!model) throw new Error(`Unknown table ${table}`);
  return model;
};
const idField = (table: PurgeTable) => modelOf(table).fields.find((f) => f.isId)!.name;
const ids = (rows: Row[], field = "id") => rows.map((r) => r[field] as string);
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
/** Pay already put in a trainer pay run (or paid) is a settled financial record. */
const isSettled = (p: { status: string; payoutRunId: string | null }) => Boolean(p.payoutRunId) || p.status === "PAID";

/** Every row that belongs only to this student, plus reasons it cannot be deleted. */
async function collect(db: Db, studentId: string) {
  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) throw notFoundError("This student no longer exists. Refresh the page.");

  const guardian = student.guardianId ? await db.guardian.findUnique({ where: { id: student.guardianId } }) : null;
  const otherChildren = guardian
    ? await db.student.findMany({ where: { guardianId: guardian.id, id: { not: studentId } }, select: { name: true, studentCode: true } })
    : [];

  const enrolments = await db.subjectEnrollment.findMany({ where: { studentId } });
  const packages = await db.studentPackage.findMany({ where: { studentId } });
  const packageIds = ids(packages);
  const allocations = await db.subjectAllocation.findMany({ where: { packageId: { in: packageIds } } });
  const slots = await db.timetableSlot.findMany({ where: { enrolmentId: { in: ids(enrolments) } } });
  const sessions = await db.session.findMany({ where: { OR: [{ studentId }, { packageId: { in: packageIds } }] } });
  const sessionIds = ids(sessions);
  const attendance = await db.attendanceRecord.findMany({ where: { sessionId: { in: sessionIds } } });
  const revisions = await db.attendanceRevision.findMany({ where: { attendanceRecordId: { in: ids(attendance) } } });
  const corrections = await db.attendanceCorrectionRequest.findMany({ where: { attendanceRecordId: { in: ids(attendance) } } });
  const ledger = await db.creditLedger.findMany({ where: { packageId: { in: packageIds } } });
  const payoutItems = await db.payoutItem.findMany({ where: { sessionId: { in: sessionIds } } });
  const invoices = await db.invoice.findMany({ where: { OR: [{ studentId }, { packageId: { in: packageIds } }] } });
  const invoiceIds = ids(invoices);
  const lineItems = await db.invoiceLineItem.findMany({ where: { invoiceId: { in: invoiceIds } } });
  const instalments = await db.invoiceInstalment.findMany({ where: { invoiceId: { in: invoiceIds } } });
  const payments = await db.payment.findMany({ where: { studentId } });
  const paymentIds = ids(payments);
  const paymentAllocations = await db.paymentAllocation.findMany({
    where: { OR: [{ paymentId: { in: paymentIds } }, { invoiceId: { in: invoiceIds } }] },
  });
  const followUps = await db.followUp.findMany({ where: { studentId } });
  const progress = await db.studentProgress.findMany({ where: { studentId } });
  const assessments = await db.assessment.findMany({ where: { studentId } });
  const concerns = await db.parentConcern.findMany({ where: { studentId } });
  const submissions = await db.parentSubmission.findMany({ where: { OR: [{ convertedStudentId: studentId }, { linkedStudentId: studentId }] } });
  const draftIds = submissions.map((s) => s.admissionDraftId).filter((d): d is string => Boolean(d));
  const drafts = await db.admissionDraft.findMany({ where: { id: { in: draftIds } } });
  const notes = await db.parentSubmissionNote.findMany({ where: { submissionId: { in: ids(submissions) } } });
  const keys = await db.idempotencyKey.findMany({
    where: { entityId: { in: [studentId, ...packageIds, ...sessionIds, ...invoiceIds, ...paymentIds, ...ids(attendance)] } },
  });

  const blockers: string[] = [];
  if (student.status !== "WITHDRAWN") {
    blockers.push(`${student.name} is not archived. Archive the student first (Remove / Archive → Archive instead), then delete permanently.`);
  }
  const settledPay = payoutItems.filter(isSettled);
  if (settledPay.length) {
    blockers.push(
      `Trainer pay for ${settledPay.length} of this student's classes is already in a pay run or paid (${rupees(settledPay.reduce((a, p) => a + p.amount, 0))}). Those pay records must stay, so this student cannot be deleted here.`
    );
  }
  const foreignSessions = sessions.filter((s) => s.studentId !== studentId);
  if (foreignSessions.length) blockers.push(`${foreignSessions.length} class(es) of another student are on this student's packages.`);
  const foreignInvoices = invoices.filter((i) => i.studentId !== studentId);
  if (foreignInvoices.length) blockers.push(`Invoice ${foreignInvoices.map((i) => i.invoiceNumber).join(", ")} of another student is linked to this student's package.`);
  const shared = paymentAllocations.filter((a) => !paymentIds.includes(a.paymentId) || !invoiceIds.includes(a.invoiceId));
  if (shared.length) blockers.push(`${shared.length} payment(s) are shared between this student and another student's invoices.`);

  const graph: PurgeGraph = {
    Guardian: guardian && otherChildren.length === 0 ? [guardian] : [],
    Student: [student as Row],
    SubjectEnrollment: enrolments,
    StudentPackage: packages,
    SubjectAllocation: allocations,
    TimetableSlot: slots,
    Session: sessions,
    AttendanceRecord: attendance,
    AttendanceRevision: revisions,
    AttendanceCorrectionRequest: corrections,
    CreditLedger: ledger,
    PayoutItem: payoutItems,
    Invoice: invoices,
    InvoiceLineItem: lineItems,
    InvoiceInstalment: instalments,
    Payment: payments,
    PaymentAllocation: paymentAllocations,
    FollowUp: followUps,
    StudentProgress: progress,
    Assessment: assessments,
    ParentConcern: concerns,
    AdmissionDraft: drafts,
    ParentSubmission: submissions,
    ParentSubmissionNote: notes,
    IdempotencyKey: keys,
  };
  return { student, guardian, otherChildren, graph, blockers, payoutItems, sessions, attendance };
}

const countOf = (graph: PurgeGraph) => Object.fromEntries(PURGE_TABLES.map((t) => [t, graph[t].length])) as Record<PurgeTable, number>;

export async function previewStudentPurge(studentId: string, db: Db = prisma): Promise<StudentPurgePreview> {
  const { student, guardian, otherChildren, graph, blockers, payoutItems, sessions, attendance } = await collect(db, studentId);
  const attendedIds = new Set(attendance.map((a) => a.sessionId));
  const now = new Date();
  const subjects = await db.subjectEnrollment.findMany({
    where: { studentId },
    include: { subject: { select: { name: true } }, teacher: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const pending = payoutItems.filter((p) => !isSettled(p));
  const payTrainers = await db.teacher.findMany({ where: { id: { in: [...new Set(pending.map((p) => p.teacherId))] } }, select: { name: true } });
  return {
    student: {
      id: student.id,
      studentCode: student.studentCode,
      name: student.name,
      grade: student.grade,
      status: student.status,
      guardianName: student.guardianName,
      whatsappNumber: student.whatsappNumber,
      email: student.email,
      createdAt: student.createdAt.toISOString(),
    },
    guardian: { removed: Boolean(guardian) && otherChildren.length === 0, otherChildren },
    subjects: subjects.map((e) => ({ subjectName: e.subject.name, teacherName: e.teacher?.name ?? null })),
    weeklySlots: graph.TimetableSlot.length,
    packages: graph.StudentPackage.map((p) => ({ packageNumber: p.packageNumber as string, name: p.name as string, totalCredits: p.totalCredits as number, status: p.status as string })),
    classes: {
      attended: sessions.filter((s) => attendedIds.has(s.id) || s.isCreditConsumed).length,
      upcoming: sessions.filter((s) => !attendedIds.has(s.id) && !s.isCreditConsumed && s.status === "SCHEDULED" && s.scheduledStartTimeUtc >= now).length,
      other: sessions.filter((s) => !attendedIds.has(s.id) && !s.isCreditConsumed && !(s.status === "SCHEDULED" && s.scheduledStartTimeUtc >= now)).length,
    },
    invoices: graph.Invoice.map((i) => ({ invoiceNumber: i.invoiceNumber as string, totalAmount: i.totalAmount as number, paidAmount: i.paidAmount as number, status: i.status as string })),
    payments: graph.Payment.map((p) => ({
      paymentNumber: p.paymentNumber as string,
      amount: p.amount as number,
      receivedDate: (p.receivedDate as Date).toISOString(),
      paymentMethod: p.paymentMethod as string,
    })),
    trainerPayPending: {
      classes: pending.length,
      amount: pending.reduce((a, p) => a + p.amount, 0),
      trainers: payTrainers.map((t) => t.name),
    },
    other: {
      followUps: graph.FollowUp.length,
      progressNotes: graph.StudentProgress.length,
      assessments: graph.Assessment.length,
      parentConcerns: graph.ParentConcern.length,
      parentForms: graph.ParentSubmission.length,
    },
    totalRecords: Object.values(countOf(graph)).reduce((a, b) => a + b, 0),
    blockers,
  };
}

/** Every row that a permanent delete would remove, as a restorable file. */
export async function buildStudentBackup(studentId: string, user: CurrentUser, db: Db = prisma): Promise<StudentBackup> {
  const { student, graph } = await collect(db, studentId);
  return {
    format: "xello-student-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    createdBy: user.name,
    student: { id: student.id, studentCode: student.studentCode, name: student.name },
    tables: graph,
  };
}

export async function purgeStudent(studentId: string, body: Record<string, unknown>, user: CurrentUser) {
  if (user.role !== "OWNER") throw forbiddenError("Only the owner can permanently delete a student.");
  const typed = typeof body.confirmStudentCode === "string" ? body.confirmStudentCode.trim().toUpperCase() : "";

  return prisma.$transaction(
    async (tx) => {
      const { student, graph, blockers } = await collect(tx, studentId);
      if (typed !== student.studentCode.toUpperCase()) {
        throw validationError("Type the student code exactly to confirm.", { confirmStudentCode: `Type ${student.studentCode} to confirm.` });
      }
      if (blockers.length) throw conflictError(blockers.join(" "));

      for (const table of [...PURGE_TABLES].reverse()) {
        const rows = graph[table];
        if (!rows.length) continue;
        const key = idField(table);
        const { count } = await delegate(tx, table).deleteMany({ where: { [key]: { in: ids(rows, key) } } });
        if (count !== rows.length) throw conflictError("The student's records changed while deleting. Nothing was deleted; refresh and try again.");
      }
      const counts = countOf(graph);
      await tx.auditLog.create({
        data: {
          entityType: "STUDENT",
          entityId: studentId,
          action: "PURGE_STUDENT",
          actorRole: user.role,
          actorName: user.name,
          // The numbers listed here are never issued again (see nextCode).
          details: JSON.stringify({
            studentCode: student.studentCode,
            name: student.name,
            guardianRemoved: counts.Guardian > 0,
            counts,
            retiredNumbers: [
              ...graph.StudentPackage.map((p) => p.packageNumber),
              ...graph.Invoice.map((i) => i.invoiceNumber),
              ...graph.Payment.map((p) => p.paymentNumber),
            ],
          }),
        },
      });
      return {
        message: `${student.name} (${student.studentCode}) and all of their records were permanently deleted. Their WhatsApp number can be used for a new admission.`,
        counts,
      };
    },
    { timeout: 30000, maxWait: 10000 }
  );
}

/** Puts a backup back (rows that already exist are skipped). For use by a one-time script if ever needed. */
export async function restoreStudentBackup(backup: StudentBackup, actorName: string, db: PrismaClient = prisma) {
  if (backup?.format !== "xello-student-backup" || backup.version !== 1 || !backup.tables) {
    throw validationError("This is not a Xello student backup file.");
  }
  return db.$transaction(
    async (tx) => {
      const restored: Record<string, number> = {};
      for (const table of PURGE_TABLES) {
        const rows = backup.tables[table] ?? [];
        if (!rows.length) continue;
        const model = modelOf(table);
        const key = idField(table);
        const dates = model.fields.filter((f) => f.kind === "scalar" && f.type === "DateTime").map((f) => f.name);
        const existing = new Set(ids(await delegate(tx, table).findMany({ where: { [key]: { in: ids(rows, key) } }, select: { [key]: true } }), key));
        const data = rows
          .filter((r) => !existing.has(r[key] as string))
          .map((r) => {
            const out: Row = { ...r };
            for (const f of dates) if (typeof out[f] === "string") out[f] = new Date(out[f] as string);
            return out;
          });
        if (data.length) restored[table] = (await delegate(tx, table).createMany({ data })).count;
      }
      await tx.auditLog.create({
        data: {
          entityType: "STUDENT",
          entityId: backup.student.id,
          action: "RESTORE_STUDENT_BACKUP",
          actorRole: "SYSTEM",
          actorName,
          details: JSON.stringify({ studentCode: backup.student.studentCode, backupCreatedAt: backup.createdAt, restored }),
        },
      });
      return restored;
    },
    { timeout: 30000, maxWait: 10000 }
  );
}
