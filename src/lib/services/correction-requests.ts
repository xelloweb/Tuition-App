/**
 * Trainer requests to correct attendance they already submitted. Submitted
 * attendance stays locked: staff apply the audited correction (which resolves
 * the request) or decline it with a note. Nobody edits as the trainer.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { ApiError, forbiddenError, notFoundError, validationError } from "../api-errors";
import { canCorrectAttendance } from "../auth";
import { FieldCollector } from "../validation";
import { SESSION_OUTCOMES, STUDENT_ATTENDANCE_VALUES } from "../attendance-ledger";

export async function createCorrectionRequest(attendanceRecordId: string, body: Record<string, unknown>, user: CurrentUser) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceRecordId },
    select: { id: true, sessionOutcome: true, studentAttendance: true, session: { select: { teacherId: true } } },
  });
  if (!record) throw notFoundError("This attendance record no longer exists. Refresh the page.");
  if (user.role !== "TEACHER" || !user.teacherId || record.session.teacherId !== user.teacherId) {
    throw forbiddenError("Only the trainer who taught this class can request a correction. Staff can correct it directly.");
  }

  const v = new FieldCollector();
  const reason = v.requiredText("reason", body.reason, "Reason", 500);
  if (reason && reason.length < 5) v.add("reason", "Explain what is wrong (at least 5 characters).");
  const requestedOutcome = body.requestedOutcome ? v.oneOf("requestedOutcome", body.requestedOutcome, SESSION_OUTCOMES, "Correct outcome") : null;
  const requestedAttendance = body.requestedAttendance
    ? v.oneOf("requestedAttendance", body.requestedAttendance, STUDENT_ATTENDANCE_VALUES, "Correct attendance")
    : null;
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

  return prisma.$transaction(async (tx) => {
    const open = await tx.attendanceCorrectionRequest.findFirst({ where: { attendanceRecordId, status: "OPEN" } });
    if (open) throw new ApiError(409, "CONFLICT", "A correction request for this class is already waiting for staff.");
    const request = await tx.attendanceCorrectionRequest.create({
      data: {
        attendanceRecordId,
        requestedByUserId: user.id,
        requestedByName: user.name,
        requestedOutcome,
        requestedAttendance,
        reason,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "ATTENDANCE",
        entityId: attendanceRecordId,
        action: "REQUEST_ATTENDANCE_CORRECTION",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ requestId: request.id, from: { outcome: record.sessionOutcome, attendance: record.studentAttendance }, requestedOutcome, requestedAttendance, reason }),
      },
    });
    return request;
  });
}

export async function declineCorrectionRequest(id: string, body: Record<string, unknown>, user: CurrentUser) {
  if (!canCorrectAttendance(user.role)) throw forbiddenError("Only the owner or an academic coordinator can decline correction requests.");
  const v = new FieldCollector();
  const note = v.requiredText("note", body.note, "Note for the trainer", 500);
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.attendanceCorrectionRequest.updateMany({
      where: { id, status: "OPEN" },
      data: { status: "DECLINED", resolvedByName: user.name, resolutionNote: note, resolvedAt: new Date() },
    });
    if (updated.count !== 1) {
      const exists = await tx.attendanceCorrectionRequest.findUnique({ where: { id } });
      if (!exists) throw notFoundError("This request no longer exists.");
      throw new ApiError(409, "CONFLICT", "This request was already handled by someone else. Refresh the page.");
    }
    const request = await tx.attendanceCorrectionRequest.findUniqueOrThrow({ where: { id } });
    await tx.auditLog.create({
      data: {
        entityType: "ATTENDANCE",
        entityId: request.attendanceRecordId,
        action: "DECLINE_ATTENDANCE_CORRECTION",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ requestId: id, note }),
      },
    });
    return request;
  });
}

/** Called inside the audited correction: open requests for the record are resolved by it. */
export async function resolveOpenRequests(tx: Prisma.TransactionClient, attendanceRecordId: string, user: CurrentUser, note: string) {
  await tx.attendanceCorrectionRequest.updateMany({
    where: { attendanceRecordId, status: "OPEN" },
    data: { status: "RESOLVED", resolvedByName: user.name, resolutionNote: note, resolvedAt: new Date() },
  });
}

/** Staff see every open request; a trainer sees their own recent requests. */
export async function listCorrectionRequests(user: CurrentUser) {
  const where: Prisma.AttendanceCorrectionRequestWhereInput = canCorrectAttendance(user.role)
    ? { status: "OPEN" }
    : { requestedByUserId: user.id };
  return prisma.attendanceCorrectionRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      attendanceRecord: {
        select: {
          id: true,
          sessionOutcome: true,
          studentAttendance: true,
          session: { select: { scheduledStartTimeUtc: true, student: { select: { name: true } }, subject: { select: { name: true } }, teacher: { select: { name: true } } } },
        },
      },
    },
  });
}
