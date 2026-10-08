/**
 * Parent submissions from the public admission form. A submission is only an
 * enquiry: it never creates a student, guardian, package, invoice, class or
 * reservation. Staff review it and confirm an admission through the normal
 * admission form, which marks the submission Converted in the same transaction.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { ApiError, conflictError, notFoundError, uniqueTargetIncludes, validationError } from "../api-errors";
import { phoneKey } from "../validation";
import { IntakeData, MANUAL_STATUSES, statusLabel } from "../intake";
import { newReference } from "../intake-server";

type Tx = Prisma.TransactionClient;

/** What is stored as `submittedData` (the parent's answers, unchanged). */
export interface StoredSubmission extends IntakeData {
  version: 1;
  timeZone: "Asia/Kolkata";
  subjects: { id: string; name: string }[];
  preferences: (IntakeData["preferences"][number] & { subjectName: string })[];
}

const normName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Reference of an earlier submission with this browser key (a retry), if any. */
export async function referenceForKey(submissionKey: string) {
  const existing = await prisma.parentSubmission.findUnique({ where: { submissionKey }, select: { reference: true } });
  return existing?.reference ?? null;
}

export async function createParentSubmission(data: IntakeData, submissionKey: string) {
  const existing = await prisma.parentSubmission.findUnique({ where: { submissionKey }, select: { reference: true } });
  if (existing) return { reference: existing.reference, replayed: true };

  const subjects = await prisma.subject.findMany({ where: { id: { in: data.subjectIds } }, select: { id: true, name: true } });
  const nameOf = new Map(subjects.map((s) => [s.id, s.name]));
  const stored: StoredSubmission = {
    version: 1,
    timeZone: "Asia/Kolkata",
    ...data,
    subjects: data.subjectIds.map((id) => ({ id, name: nameOf.get(id) ?? "Subject" })),
    preferences: data.preferences.map((p) => ({ ...p, subjectName: nameOf.get(p.subjectId) ?? "Subject" })),
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = newReference();
    try {
      await prisma.$transaction(async (tx) => {
        const submission = await tx.parentSubmission.create({
          data: {
            reference,
            submissionKey,
            submittedData: JSON.stringify(stored),
            studentName: data.studentName,
            grade: data.grade,
            board: data.board,
            subjectNames: stored.subjects.map((s) => s.name).join(", "),
            guardianName: data.guardianName,
            whatsappNumber: data.whatsappNumber,
            whatsappKey: phoneKey(data.whatsappNumber),
            country: data.country,
          },
        });
        // No personal details in the audit trail: the reference is enough.
        await tx.auditLog.create({
          data: {
            entityType: "PARENT_SUBMISSION",
            entityId: submission.id,
            action: "PARENT_FORM_SUBMITTED",
            actorRole: "PARENT",
            actorName: "Parent form",
            details: JSON.stringify({ reference }),
          },
        });
      });
      return { reference, replayed: false };
    } catch (err) {
      if (uniqueTargetIncludes(err, "submissionKey")) {
        const winner = await prisma.parentSubmission.findUnique({ where: { submissionKey }, select: { reference: true } });
        if (winner) return { reference: winner.reference, replayed: true };
      }
      if (uniqueTargetIncludes(err, "reference")) continue;
      throw err;
    }
  }
  throw new ApiError(503, "SERVER_BUSY", "We could not save your details just now. Nothing was saved. Please try again.");
}

export function readStored(json: string): StoredSubmission | null {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as StoredSubmission) : null;
  } catch {
    return null;
  }
}

/** Lightweight directory used to flag possible duplicates and siblings (staff only). */
async function loadDirectory() {
  const [guardians, students] = await Promise.all([
    prisma.guardian.findMany({ select: { id: true, name: true, whatsappNumber: true, students: { select: { id: true, name: true, studentCode: true } } } }),
    prisma.student.findMany({ select: { id: true, name: true, studentCode: true, guardianName: true, whatsappNumber: true } }),
  ]);
  return { guardians, students };
}
type Directory = Awaited<ReturnType<typeof loadDirectory>>;

function flagsFor(
  s: { id: string; studentName: string; whatsappKey: string },
  dir: Directory,
  others: { id: string; studentName: string; whatsappKey: string }[]
): string[] {
  const flags: string[] = [];
  const name = normName(s.studentName);
  const sameStudentExists = dir.students.some((st) => normName(st.name) === name && phoneKey(st.whatsappNumber) === s.whatsappKey);
  const sameSubmission = others.some((o) => o.id !== s.id && o.whatsappKey === s.whatsappKey && normName(o.studentName) === name);
  if (sameStudentExists || sameSubmission) flags.push("Possible duplicate");
  else if (dir.guardians.some((g) => phoneKey(g.whatsappNumber) === s.whatsappKey)) flags.push("Known parent number");
  return flags;
}

export type SubmissionFilter = { status?: string; assigned?: string; q?: string };

export async function listSubmissions(user: CurrentUser, filter: SubmissionFilter, take = 100) {
  const where: Prisma.ParentSubmissionWhereInput = {};
  const status = filter.status ?? "OPEN";
  if (status === "OPEN") where.status = { notIn: ["CONVERTED", "CLOSED"] };
  else if (status !== "ALL") where.status = status;
  if (filter.assigned === "ME") where.assignedToUserId = user.id;
  else if (filter.assigned === "UNASSIGNED") where.assignedToUserId = null;
  const q = filter.q?.trim().slice(0, 80);
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { reference: { contains: q.toUpperCase() } },
      { studentName: { contains: q } },
      { guardianName: { contains: q } },
      { subjectNames: { contains: q } },
      ...(digits.length >= 4 ? [{ whatsappKey: { contains: digits } }] : []),
    ];
  }
  const [rows, total, dir] = await Promise.all([
    prisma.parentSubmission.findMany({ where, orderBy: { createdAt: "desc" }, take }),
    prisma.parentSubmission.count({ where }),
    loadDirectory(),
  ]);
  const everyone = await prisma.parentSubmission.findMany({
    where: { whatsappKey: { in: [...new Set(rows.map((r) => r.whatsappKey))] } },
    select: { id: true, studentName: true, whatsappKey: true },
  });
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      studentName: r.studentName,
      grade: r.grade,
      board: r.board,
      subjectNames: r.subjectNames,
      guardianName: r.guardianName,
      whatsappNumber: r.whatsappNumber,
      status: r.status,
      statusLabel: statusLabel(r.status),
      assignedToName: r.assignedToName,
      followUpOn: r.followUpOn,
      unread: !r.seenAt,
      createdAt: r.createdAt.toISOString(),
      flags: flagsFor(r, dir, everyone),
    })),
  };
}
export type SubmissionListItem = Awaited<ReturnType<typeof listSubmissions>>["items"][number];

export async function getSubmissionDetail(id: string) {
  const s = await prisma.parentSubmission.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      admissionDraft: { select: { id: true, updatedAt: true, updatedByName: true } },
      convertedStudent: { select: { id: true, name: true, studentCode: true } },
      linkedStudent: { select: { id: true, name: true, studentCode: true } },
    },
  });
  if (!s) return null;
  const dir = await loadDirectory();
  const name = normName(s.studentName);
  const others = await prisma.parentSubmission.findMany({
    where: { whatsappKey: s.whatsappKey, NOT: { id: s.id } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, reference: true, studentName: true, status: true, createdAt: true },
  });
  return {
    id: s.id,
    reference: s.reference,
    status: s.status,
    statusLabel: statusLabel(s.status),
    assignedToUserId: s.assignedToUserId,
    assignedToName: s.assignedToName,
    followUpOn: s.followUpOn,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    convertedAt: s.convertedAt?.toISOString() ?? null,
    convertedByName: s.convertedByName,
    submitted: readStored(s.submittedData),
    draft: s.admissionDraft ? { id: s.admissionDraft.id, updatedAt: s.admissionDraft.updatedAt.toISOString(), updatedByName: s.admissionDraft.updatedByName } : null,
    convertedStudent: s.convertedStudent,
    linkedStudent: s.linkedStudent,
    notes: s.notes.map((n) => ({ id: n.id, body: n.body, authorName: n.authorName, createdAt: n.createdAt.toISOString() })),
    matches: {
      guardians: dir.guardians
        .filter((g) => phoneKey(g.whatsappNumber) === s.whatsappKey)
        .map((g) => ({ id: g.id, name: g.name, whatsappNumber: g.whatsappNumber, students: g.students })),
      sameNameStudents: dir.students
        .filter((st) => normName(st.name) === name)
        .map((st) => ({ id: st.id, name: st.name, studentCode: st.studentCode, guardianName: st.guardianName, samePhone: phoneKey(st.whatsappNumber) === s.whatsappKey })),
      otherSubmissions: others.map((o) => ({ ...o, createdAt: o.createdAt.toISOString(), sameName: normName(o.studentName) === name, statusLabel: statusLabel(o.status) })),
    },
  };
}
export type SubmissionDetail = NonNullable<Awaited<ReturnType<typeof getSubmissionDetail>>>;

/** First staff view clears the unread indicator. */
export async function markSubmissionSeen(id: string) {
  await prisma.parentSubmission.updateMany({ where: { id, seenAt: null }, data: { seenAt: new Date() } });
}

export const countUnreadSubmissions = () => prisma.parentSubmission.count({ where: { seenAt: null, status: { notIn: ["CONVERTED", "CLOSED"] } } });

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Status, assignment, follow-up date and association with an existing student. Audited. */
export async function updateSubmission(id: string, body: Record<string, unknown>, user: CurrentUser) {
  const current = await prisma.parentSubmission.findUnique({ where: { id } });
  if (!current) throw notFoundError("This submission no longer exists. Refresh the page.");
  const data: Prisma.ParentSubmissionUncheckedUpdateInput = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const fieldErrors: Record<string, string> = {};

  if (body.status !== undefined) {
    if (current.status === "CONVERTED") throw conflictError("This submission is already converted into an admission and can no longer change status.");
    if (typeof body.status !== "string" || !(MANUAL_STATUSES as string[]).includes(body.status)) {
      fieldErrors.status = body.status === "CONVERTED" ? "Converted is set automatically when the admission is confirmed." : "Choose a status from the list.";
    } else if (body.status !== current.status) {
      data.status = body.status;
      changes.status = { from: current.status, to: body.status };
    }
  }
  if (body.assignedToUserId !== undefined) {
    const assignee = body.assignedToUserId === null || body.assignedToUserId === "" ? null : String(body.assignedToUserId);
    if (assignee) {
      const staff = await prisma.user.findFirst({ where: { id: assignee, active: true, role: { in: ["OWNER", "COORDINATOR"] } } });
      if (!staff) fieldErrors.assignedToUserId = "Choose an active owner or coordinator.";
      else if (staff.id !== current.assignedToUserId) {
        data.assignedToUserId = staff.id;
        data.assignedToName = staff.name;
        changes.assignedTo = { from: current.assignedToName, to: staff.name };
      }
    } else if (current.assignedToUserId) {
      data.assignedToUserId = null;
      data.assignedToName = null;
      changes.assignedTo = { from: current.assignedToName, to: null };
    }
  }
  if (body.followUpOn !== undefined) {
    const value = body.followUpOn === null || body.followUpOn === "" ? null : String(body.followUpOn);
    if (value && (!DATE.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()))) fieldErrors.followUpOn = "Enter a valid date.";
    else if (value !== current.followUpOn) {
      data.followUpOn = value;
      changes.followUpOn = { from: current.followUpOn, to: value };
    }
  }
  if (body.linkedStudentId !== undefined) {
    const value = body.linkedStudentId === null || body.linkedStudentId === "" ? null : String(body.linkedStudentId);
    if (value) {
      const student = await prisma.student.findUnique({ where: { id: value }, select: { id: true, name: true, studentCode: true } });
      if (!student) fieldErrors.linkedStudentId = "This student no longer exists.";
      else if (value !== current.linkedStudentId) {
        data.linkedStudentId = value;
        changes.linkedStudent = { from: current.linkedStudentId, to: `${student.name} (${student.studentCode})` };
      }
    } else if (current.linkedStudentId) {
      data.linkedStudentId = null;
      changes.linkedStudent = { from: current.linkedStudentId, to: null };
    }
  }
  if (Object.keys(fieldErrors).length) throw validationError("Please correct the highlighted fields.", fieldErrors);
  if (Object.keys(changes).length === 0) return getSubmissionDetail(id);

  await prisma.$transaction([
    prisma.parentSubmission.update({ where: { id }, data }),
    prisma.auditLog.create({
      data: {
        entityType: "PARENT_SUBMISSION",
        entityId: id,
        action: "UPDATE_PARENT_SUBMISSION",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ reference: current.reference, changes }),
      },
    }),
  ]);
  return getSubmissionDetail(id);
}

export async function addSubmissionNote(id: string, body: Record<string, unknown>, user: CurrentUser) {
  const text = typeof body.body === "string" ? body.body.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim() : "";
  if (!text) throw validationError("Write the note first.", { body: "Write the note first." });
  if (text.length > 2000) throw validationError("Keep the note to 2,000 characters or fewer.", { body: "Keep the note to 2,000 characters or fewer." });
  const current = await prisma.parentSubmission.findUnique({ where: { id }, select: { reference: true } });
  if (!current) throw notFoundError("This submission no longer exists. Refresh the page.");
  await prisma.$transaction([
    prisma.parentSubmissionNote.create({ data: { submissionId: id, body: text, authorName: user.name, authorRole: user.role } }),
    prisma.auditLog.create({
      data: { entityType: "PARENT_SUBMISSION", entityId: id, action: "NOTE_PARENT_SUBMISSION", actorRole: user.role, actorName: user.name, details: JSON.stringify({ reference: current.reference }) },
    }),
  ]);
  return getSubmissionDetail(id);
}

/**
 * Links a new admission draft to its submission. Refused if the submission
 * already has a draft (resume that one) or is already converted.
 */
export async function linkDraftInTransaction(tx: Tx, submissionId: string, draftId: string, user: CurrentUser) {
  const result = await tx.parentSubmission.updateMany({
    where: { id: submissionId, admissionDraftId: null, status: { not: "CONVERTED" } },
    data: { admissionDraftId: draftId },
  });
  if (result.count === 0) {
    const current = await tx.parentSubmission.findUnique({ where: { id: submissionId }, select: { status: true } });
    if (!current) throw notFoundError("This parent submission no longer exists. Refresh the page.");
    if (current.status === "CONVERTED") throw conflictError("This submission is already converted into an admission.");
    throw conflictError("This submission already has an admission draft. Close this form and use “Continue admission” on the submission.");
  }
  await tx.auditLog.create({
    data: { entityType: "PARENT_SUBMISSION", entityId: submissionId, action: "START_ADMISSION_DRAFT", actorRole: user.role, actorName: user.name, details: JSON.stringify({ draftId }) },
  });
}

/**
 * Marks the submission Converted inside the admission transaction. Exactly one
 * admission can convert a submission: a second attempt fails and rolls back.
 */
export async function convertInTransaction(tx: Tx, submissionId: string, studentId: string, user: CurrentUser) {
  const result = await tx.parentSubmission.updateMany({
    where: { id: submissionId, status: { not: "CONVERTED" }, convertedStudentId: null },
    data: { status: "CONVERTED", convertedStudentId: studentId, convertedAt: new Date(), convertedByName: user.name, admissionDraftId: null },
  });
  if (result.count === 0) {
    const current = await tx.parentSubmission.findUnique({ where: { id: submissionId }, select: { reference: true, convertedByName: true } });
    if (!current) throw notFoundError("This parent submission no longer exists. Refresh the page.");
    throw conflictError(
      `Submission ${current.reference} was already converted into an admission${current.convertedByName ? ` by ${current.convertedByName}` : ""}. Nothing was saved.`
    );
  }
  const s = await tx.parentSubmission.findUniqueOrThrow({ where: { id: submissionId }, select: { reference: true } });
  await tx.auditLog.create({
    data: { entityType: "PARENT_SUBMISSION", entityId: submissionId, action: "CONVERT_PARENT_SUBMISSION", actorRole: user.role, actorName: user.name, details: JSON.stringify({ reference: s.reference, studentId }) },
  });
}

/**
 * Deletes a submission at the parent's request (owner only). A converted
 * submission belongs to a student record and is not deleted here. Its notes and
 * any unfinished admission draft (which holds the same details) go with it; the
 * audit trail keeps only the reference.
 */
export async function deleteSubmission(id: string, user: CurrentUser) {
  const current = await prisma.parentSubmission.findUnique({ where: { id }, select: { reference: true, status: true, admissionDraftId: true } });
  if (!current) throw notFoundError("This submission no longer exists. Refresh the page.");
  if (current.status === "CONVERTED") {
    throw conflictError("This submission became an admission. Its details now belong to the student record, so it cannot be deleted here.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.parentSubmission.delete({ where: { id } });
    if (current.admissionDraftId) await tx.admissionDraft.deleteMany({ where: { id: current.admissionDraftId } });
    await tx.auditLog.create({
      data: {
        entityType: "PARENT_SUBMISSION",
        entityId: id,
        action: "DELETE_PARENT_SUBMISSION",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ reference: current.reference, draftDeleted: Boolean(current.admissionDraftId) }),
      },
    });
  });
  return { reference: current.reference };
}

/** The submission an admission draft belongs to, if any. */
export async function submissionForDraft(tx: Tx, draftId: string) {
  return tx.parentSubmission.findUnique({ where: { admissionDraftId: draftId }, select: { id: true } });
}
