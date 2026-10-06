import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CurrentUser, SessionOutcome, StudentAttendance } from "./types";
import { canCorrectAttendance, canMarkAttendance } from "./auth";
import { ApiError, conflictError, forbiddenError, notFoundError, uniqueTargetIncludes, validationError } from "./api-errors";
import { FieldCollector } from "./validation";
import { getTeacherRateForGrade } from "./rates";

export { getTeacherRateForGrade };

export const SESSION_OUTCOMES: SessionOutcome[] = ["COMPLETED", "STUDENT_NO_SHOW", "TEACHER_NO_SHOW", "CANCELLED"];
export const STUDENT_ATTENDANCE_VALUES: StudentAttendance[] = ["PRESENT", "LATE", "ABSENT"];

export interface SubmitAttendanceParams {
  sessionId: string;
  sessionOutcome: SessionOutcome;
  studentAttendance: StudentAttendance;
  actualDurationMinutes: number;
  topicCovered: string;
  homework?: string;
  studentProgressNote?: string;
  user: CurrentUser;
}

/** Validates an attendance payload from the API. */
export function parseAttendanceBody(body: Record<string, unknown>) {
  const v = new FieldCollector();
  const sessionOutcome = v.oneOf("sessionOutcome", body.sessionOutcome, SESSION_OUTCOMES, "Class outcome");
  const studentAttendance = v.oneOf("studentAttendance", body.studentAttendance, STUDENT_ATTENDANCE_VALUES, "Student attendance");
  const actualDurationMinutes = v.integer("actualDurationMinutes", body.actualDurationMinutes, "Actual duration (minutes)", {
    min: 0,
    max: 300,
    fallback: 60,
  });
  const topicCovered = v.optionalText("topicCovered", body.topicCovered, "Topic covered", 500) ?? "General curriculum session";
  const homework = v.optionalText("homework", body.homework, "Homework", 1000) ?? undefined;
  const studentProgressNote = v.optionalText("studentProgressNote", body.studentProgressNote, "Progress note", 1000) ?? undefined;
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);
  return { sessionOutcome, studentAttendance, actualDurationMinutes, topicCovered, homework, studentProgressNote };
}

function consumesCredit(
  outcome: SessionOutcome,
  pkg: { noShowDeductCredit: boolean; cancellationNoticeHours: number },
  scheduledStart: Date,
  now: Date
): boolean {
  switch (outcome) {
    case "COMPLETED":
      return true;
    case "STUDENT_NO_SHOW":
      return pkg.noShowDeductCredit;
    case "CANCELLED": {
      // Late cancellation follows the package no-show policy; adequate notice is free.
      const hoursNotice = (scheduledStart.getTime() - now.getTime()) / 3600000;
      return hoursNotice < pkg.cancellationNoticeHours ? pkg.noShowDeductCredit : false;
    }
    case "TEACHER_NO_SHOW":
      // Teacher absence never consumes the student's credit.
      return false;
  }
}

async function createPayoutItem(
  tx: Prisma.TransactionClient,
  session: { id: string; teacherId: string; scheduledStartTimeUtc: Date; teacher: { defaultRate: number; gradeRates: string | null }; student: { grade: string } },
  actualDurationMinutes: number,
  note = ""
) {
  const ratePerHour = getTeacherRateForGrade(session.teacher, session.student.grade);
  const amount = Math.round((ratePerHour * actualDurationMinutes) / 60);
  await tx.payoutItem.create({
    data: {
      teacherId: session.teacherId,
      sessionId: session.id,
      sessionDate: session.scheduledStartTimeUtc,
      durationMinutes: actualDurationMinutes,
      rateSnapshot: ratePerHour,
      amount,
      status: "APPROVED",
      notes: `${session.student.grade} standard rate: ₹${ratePerHour}/hr × ${(actualDurationMinutes / 60).toFixed(1)} hrs = ₹${amount} earned${note}`,
    },
  });
}

/**
 * Records attendance once. A repeated identical submission (double click,
 * retry) returns the original result; a different outcome must go through
 * correctAttendanceRecord so the change is audited.
 */
export async function submitSessionAttendance(params: SubmitAttendanceParams) {
  const { sessionId, sessionOutcome, studentAttendance, actualDurationMinutes, topicCovered, homework, studentProgressNote, user } = params;

  const alreadyProcessed = async () => {
    const existing = await prisma.attendanceRecord.findUnique({ where: { sessionId }, include: { session: true } });
    if (!existing) throw conflictError("Attendance could not be recorded. Refresh and try again.");
    if (existing.sessionOutcome !== sessionOutcome || existing.studentAttendance !== studentAttendance) {
      throw new ApiError(
        409,
        "CONFLICT",
        `Attendance was already recorded as ${existing.sessionOutcome.replace(/_/g, " ").toLowerCase()} (${existing.studentAttendance.toLowerCase()}). Use "Correct attendance" to change it — corrections keep an audit trail.`
      );
    }
    return {
      success: true,
      alreadyProcessed: true,
      message: "Attendance was already submitted for this class; nothing was charged twice.",
      attendanceId: existing.id,
      shouldConsumeCredit: existing.session.isCreditConsumed,
    };
  };

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { package: true, student: true, teacher: true, attendance: true },
  });
  if (!session) throw notFoundError("This class no longer exists. Refresh the page.");
  if (!canMarkAttendance(user.role, user.teacherId, session.teacherId)) {
    throw forbiddenError("You can only mark attendance for your own classes.");
  }
  if (session.attendance) return alreadyProcessed();
  if (session.status === "RESCHEDULED") {
    throw conflictError("This class was rescheduled. Mark attendance on the replacement class instead.");
  }
  const now = new Date();
  if (sessionOutcome === "COMPLETED" && session.scheduledStartTimeUtc > now) {
    throw conflictError("A class cannot be marked completed before it starts.");
  }
  const shouldConsumeCredit = consumesCredit(sessionOutcome, session.package, session.scheduledStartTimeUtc, now);

  try {
    return await prisma.$transaction(async (tx) => {
      // Only the request that flips the session from SCHEDULED proceeds; a
      // concurrent duplicate sees count 0 and is treated as a replay.
      const claimed = await tx.session.updateMany({
        where: { id: sessionId, status: "SCHEDULED", isCreditConsumed: false },
        data: { status: sessionOutcome, isCreditReserved: false, isCreditConsumed: shouldConsumeCredit },
      });
      if (claimed.count !== 1) throw new ApiError(409, "CONFLICT", "__ALREADY_PROCESSED__");

      const attendance = await tx.attendanceRecord.create({
        data: {
          sessionId,
          sessionOutcome,
          studentAttendance,
          actualDurationMinutes,
          topicCovered,
          homework: homework || null,
          studentProgressNote: studentProgressNote || null,
          markedByRole: user.role,
          markedByName: user.name,
          markedAt: now,
        },
      });

      if (shouldConsumeCredit) {
        const alloc = await tx.subjectAllocation.findUnique({
          where: { packageId_subjectId: { packageId: session.packageId, subjectId: session.subjectId } },
        });
        const consumed = await tx.session.count({
          where: { packageId: session.packageId, subjectId: session.subjectId, isCreditConsumed: true },
        });
        await tx.creditLedger.create({
          data: {
            packageId: session.packageId,
            subjectId: session.subjectId,
            eventType: "SESSION_CONSUMED",
            creditsDelta: -1,
            resultingRemaining: (alloc?.allocatedCredits ?? 0) - consumed,
            sessionId: session.id,
            reason: `Class attendance processed: ${sessionOutcome} (${topicCovered})`,
            actorRole: user.role,
            actorName: user.name,
            metadata: JSON.stringify({ studentAttendance, actualDurationMinutes }),
          },
        });
      }

      if (sessionOutcome === "COMPLETED") {
        const existingPayout = await tx.payoutItem.findUnique({ where: { sessionId: session.id } });
        if (!existingPayout) await createPayoutItem(tx, session, actualDurationMinutes);
      }

      await tx.auditLog.create({
        data: {
          entityType: "ATTENDANCE",
          entityId: attendance.id,
          action: "SUBMIT_ATTENDANCE",
          actorRole: user.role,
          actorName: user.name,
          details: JSON.stringify({ sessionId, sessionOutcome, studentAttendance, shouldConsumeCredit }),
        },
      });

      return { success: true, alreadyProcessed: false, shouldConsumeCredit, attendanceId: attendance.id };
    });
  } catch (err) {
    if ((err instanceof ApiError && err.message === "__ALREADY_PROCESSED__") || uniqueTargetIncludes(err, "sessionId")) {
      return alreadyProcessed();
    }
    throw err;
  }
}

/**
 * Changes a recorded outcome with a mandatory reason. Keeps a revision row,
 * reverses or applies the credit through the ledger, and keeps the trainer
 * payout consistent (cancelled if unpaid; flagged for manual adjustment if it
 * was already batched or paid).
 */
export async function correctAttendanceRecord(
  attendanceId: string,
  newOutcome: SessionOutcome,
  newAttendance: StudentAttendance,
  reason: string,
  user: CurrentUser
) {
  if (!canCorrectAttendance(user.role)) {
    throw forbiddenError("Only the owner or an academic coordinator can correct attendance.");
  }
  if (!SESSION_OUTCOMES.includes(newOutcome) || !STUDENT_ATTENDANCE_VALUES.includes(newAttendance)) {
    throw validationError("Choose a valid outcome and attendance status.");
  }
  if (!reason || reason.trim().length < 5) {
    throw validationError("A detailed reason is required for attendance correction.", {
      reason: "Explain the correction (at least 5 characters).",
    });
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId },
    include: { session: { include: { package: true, teacher: true, student: true } } },
  });
  if (!record) throw notFoundError("Attendance record not found.");
  if (record.sessionOutcome === newOutcome && record.studentAttendance === newAttendance) {
    throw validationError("The new outcome is the same as the recorded one; nothing to correct.");
  }

  const session = record.session;
  const warnings: string[] = [];

  const updatedRecord = await prisma.$transaction(async (tx) => {
    await tx.attendanceRevision.create({
      data: {
        attendanceRecordId: record.id,
        sessionId: session.id,
        previousOutcome: record.sessionOutcome,
        newOutcome,
        previousAttendance: record.studentAttendance,
        newAttendance,
        reason: reason.trim(),
        actorRole: user.role,
        actorName: user.name,
      },
    });

    const current = await tx.session.findUniqueOrThrow({ where: { id: session.id } });
    const wasConsumed = current.isCreditConsumed;
    // Corrections are recorded after the fact, so cancellation notice is not re-evaluated.
    const shouldBeConsumed =
      newOutcome === "COMPLETED" ? true : newOutcome === "STUDENT_NO_SHOW" ? session.package.noShowDeductCredit : false;

    if (wasConsumed !== shouldBeConsumed) {
      const flipped = await tx.session.updateMany({
        where: { id: session.id, isCreditConsumed: wasConsumed },
        data: { status: newOutcome, isCreditConsumed: shouldBeConsumed },
      });
      if (flipped.count !== 1) throw conflictError("This class was changed by someone else. Refresh and try again.");
      await tx.creditLedger.create({
        data: {
          packageId: session.packageId,
          subjectId: session.subjectId,
          eventType: shouldBeConsumed ? "SESSION_CONSUMED" : "SESSION_REVERSED",
          creditsDelta: shouldBeConsumed ? -1 : 1,
          sessionId: session.id,
          reason: `Attendance corrected from ${record.sessionOutcome} to ${newOutcome}: ${reason.trim()}`,
          actorRole: user.role,
          actorName: user.name,
        },
      });
    } else {
      await tx.session.update({ where: { id: session.id }, data: { status: newOutcome } });
    }

    // Keep the trainer payout in line with what actually happened.
    const payout = await tx.payoutItem.findUnique({ where: { sessionId: session.id } });
    const wasCompleted = record.sessionOutcome === "COMPLETED";
    const nowCompleted = newOutcome === "COMPLETED";
    if (wasCompleted && !nowCompleted && payout && payout.status !== "CANCELLED") {
      if (payout.payoutRunId || payout.status === "PAID") {
        warnings.push(
          `The trainer payout for this class (₹${payout.amount}) is already ${payout.status === "PAID" ? "paid" : "in a payout run"}; it was not changed. Record a manual payout adjustment.`
        );
        await tx.auditLog.create({
          data: {
            entityType: "PAYOUT_ITEM",
            entityId: payout.id,
            action: "PAYOUT_ADJUSTMENT_REQUIRED",
            actorRole: user.role,
            actorName: user.name,
            details: JSON.stringify({ sessionId: session.id, amount: payout.amount, reason: reason.trim() }),
          },
        });
      } else {
        await tx.payoutItem.update({
          where: { id: payout.id },
          data: { status: "CANCELLED", notes: `${payout.notes ?? ""} | Cancelled by attendance correction: ${reason.trim()}` },
        });
      }
    } else if (!wasCompleted && nowCompleted) {
      if (!payout) {
        await createPayoutItem(tx, session, record.actualDurationMinutes || session.durationMinutes, " (added by attendance correction)");
      } else if (payout.status === "CANCELLED" && !payout.payoutRunId) {
        await tx.payoutItem.update({ where: { id: payout.id }, data: { status: "APPROVED" } });
      }
    }

    const updated = await tx.attendanceRecord.update({
      where: { id: record.id },
      data: {
        sessionOutcome: newOutcome,
        studentAttendance: newAttendance,
        isReversed: wasConsumed && !shouldBeConsumed,
        reversalReason: wasConsumed && !shouldBeConsumed ? reason.trim() : record.reversalReason,
        reversedAt: wasConsumed && !shouldBeConsumed ? new Date() : record.reversedAt,
        reversedByName: wasConsumed && !shouldBeConsumed ? user.name : record.reversedByName,
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: "ATTENDANCE",
        entityId: record.id,
        action: "CORRECT_ATTENDANCE",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          sessionId: session.id,
          from: { outcome: record.sessionOutcome, attendance: record.studentAttendance },
          to: { outcome: newOutcome, attendance: newAttendance },
          creditChange: wasConsumed === shouldBeConsumed ? 0 : shouldBeConsumed ? -1 : 1,
          reason: reason.trim(),
        }),
      },
    });
    return updated;
  });

  return Object.assign(updatedRecord, { warnings });
}
