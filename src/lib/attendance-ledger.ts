import { prisma } from "./prisma";
import { CurrentUser, SessionOutcome, StudentAttendance } from "./types";
import { canMarkAttendance } from "./auth";

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

export async function submitSessionAttendance(params: SubmitAttendanceParams) {
  const {
    sessionId,
    sessionOutcome,
    studentAttendance,
    actualDurationMinutes,
    topicCovered,
    homework,
    studentProgressNote,
    user,
  } = params;

  // 1. Fetch session with package and teacher details
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      package: true,
      teacher: true,
      attendance: true,
      subject: true,
    },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  // 2. Teacher authorization check
  if (!canMarkAttendance(user.role, user.teacherId, session.teacherId)) {
    throw new Error("Forbidden: You cannot mark attendance for another teacher's session.");
  }

  // 3. Prevent marking future classes as completed
  const now = new Date();
  if (sessionOutcome === "COMPLETED" && new Date(session.scheduledStartTimeUtc) > now) {
    throw new Error("Future scheduled classes cannot be marked completed prior to the session start time.");
  }

  // 4. Idempotency safeguard: if already completed and consumed, do not charge again!
  if (session.isCreditConsumed && session.attendance) {
    return {
      success: true,
      alreadyProcessed: true,
      message: "Attendance was already submitted and credit processed for this session.",
      attendanceId: session.attendance.id,
      shouldConsumeCredit: true,
    };
  }

  // 5. Evaluate policy on whether credit should be consumed
  let shouldConsumeCredit = false;

  if (sessionOutcome === "COMPLETED") {
    shouldConsumeCredit = true;
  } else if (sessionOutcome === "STUDENT_NO_SHOW") {
    // Follow package policy
    shouldConsumeCredit = session.package.noShowDeductCredit;
  } else if (sessionOutcome === "CANCELLED") {
    // Check notice period in hours
    const hoursNotice =
      (new Date(session.scheduledStartTimeUtc).getTime() - now.getTime()) /
      (1000 * 60 * 60);
    if (hoursNotice < session.package.cancellationNoticeHours) {
      // Late cancellation: if policy deducts for late cancellation
      shouldConsumeCredit = session.package.noShowDeductCredit;
    } else {
      // Notice was sufficient: no deduction
      shouldConsumeCredit = false;
    }
  } else if (sessionOutcome === "TEACHER_NO_SHOW") {
    // Mandatory requirement: Teacher absence NEVER consumes student credit!
    shouldConsumeCredit = false;
  }

  // 6. Execute atomic transaction
  return await prisma.$transaction(async (tx) => {
    // Create or update attendance record
    const attendance = await tx.attendanceRecord.upsert({
      where: { sessionId },
      update: {
        sessionOutcome,
        studentAttendance,
        actualDurationMinutes,
        topicCovered,
        homework: homework || null,
        studentProgressNote: studentProgressNote || null,
        markedByRole: user.role,
        markedByName: user.name,
        markedAt: new Date(),
        isReversed: false,
      },
      create: {
        sessionId,
        sessionOutcome,
        studentAttendance,
        actualDurationMinutes,
        topicCovered,
        homework: homework || null,
        studentProgressNote: studentProgressNote || null,
        markedByRole: user.role,
        markedByName: user.name,
        markedAt: new Date(),
      },
    });

    // Update session status
    await tx.session.update({
      where: { id: sessionId },
      data: {
        status: sessionOutcome,
        isCreditReserved: false,
        isCreditConsumed: shouldConsumeCredit,
      },
    });

    // If credit is to be consumed, record credit ledger entry
    if (shouldConsumeCredit && !session.isCreditConsumed) {
      // Read current remaining balance for subject
      const alloc = await tx.subjectAllocation.findUnique({
        where: {
          packageId_subjectId: {
            packageId: session.packageId,
            subjectId: session.subjectId,
          },
        },
      });

      const totalConsumedBefore = await tx.session.count({
        where: {
          packageId: session.packageId,
          subjectId: session.subjectId,
          isCreditConsumed: true,
        },
      });

      const remainingAfter = (alloc?.allocatedCredits || 0) - (totalConsumedBefore + 1);

      await tx.creditLedger.create({
        data: {
          packageId: session.packageId,
          subjectId: session.subjectId,
          eventType: "SESSION_CONSUMED",
          creditsDelta: -1,
          resultingRemaining: remainingAfter,
          sessionId: session.id,
          reason: `Class attendance processed: ${sessionOutcome} (${topicCovered})`,
          actorRole: user.role,
          actorName: user.name,
          metadata: JSON.stringify({
            studentAttendance,
            actualDurationMinutes,
          }),
        },
      });
    }

    // Teacher payout record generation if session completed and eligible
    if (sessionOutcome === "COMPLETED") {
      const existingPayoutItem = await tx.payoutItem.findUnique({
        where: { sessionId: session.id },
      });

      if (!existingPayoutItem) {
        const ratePerHour = session.teacher.defaultRate;
        const payoutAmount = Math.round((ratePerHour * actualDurationMinutes) / 60);

        await tx.payoutItem.create({
          data: {
            teacherId: session.teacherId,
            sessionId: session.id,
            sessionDate: session.scheduledStartTimeUtc,
            durationMinutes: actualDurationMinutes,
            rateSnapshot: ratePerHour,
            amount: payoutAmount,
            status: "APPROVED",
            notes: `Eligible session: ${session.subject.name} with ${actualDurationMinutes} mins taught`,
          },
        });
      }
    }

    // Audit Log
    await tx.auditLog.create({
      data: {
        entityType: "ATTENDANCE",
        entityId: attendance.id,
        action: "SUBMIT_ATTENDANCE",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          sessionId,
          sessionOutcome,
          studentAttendance,
          shouldConsumeCredit,
        }),
      },
    });

    return {
      success: true,
      alreadyProcessed: false,
      shouldConsumeCredit,
      attendanceId: attendance.id,
    };
  });
}

export async function correctAttendanceRecord(
  attendanceId: string,
  newOutcome: SessionOutcome,
  newAttendance: StudentAttendance,
  reason: string,
  user: CurrentUser
) {
  if (!reason || reason.trim().length < 5) {
    throw new Error("A detailed reason is required for attendance correction.");
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId },
    include: {
      session: {
        include: {
          package: true,
          teacher: true,
          subject: true,
        },
      },
    },
  });

  if (!record) {
    throw new Error("Attendance record not found.");
  }

  const session = record.session;

  return await prisma.$transaction(async (tx) => {
    // 1. Log revision history
    await tx.attendanceRevision.create({
      data: {
        attendanceRecordId: record.id,
        sessionId: session.id,
        previousOutcome: record.sessionOutcome,
        newOutcome,
        previousAttendance: record.studentAttendance,
        newAttendance,
        reason,
        actorRole: user.role,
        actorName: user.name,
      },
    });

    // 2. Evaluate credit consumption delta
    const wasConsumed = session.isCreditConsumed;
    let shouldBeConsumed = false;

    if (newOutcome === "COMPLETED") {
      shouldBeConsumed = true;
    } else if (newOutcome === "STUDENT_NO_SHOW") {
      shouldBeConsumed = session.package.noShowDeductCredit;
    } else {
      shouldBeConsumed = false;
    }

    // If previously consumed and now NOT consumed -> Reversal!
    if (wasConsumed && !shouldBeConsumed) {
      await tx.creditLedger.create({
        data: {
          packageId: session.packageId,
          subjectId: session.subjectId,
          eventType: "SESSION_REVERSED",
          creditsDelta: 1, // Restoring credit
          sessionId: session.id,
          reason: `Attendance corrected from ${record.sessionOutcome} to ${newOutcome}: ${reason}`,
          actorRole: user.role,
          actorName: user.name,
        },
      });

      await tx.session.update({
        where: { id: session.id },
        data: {
          status: newOutcome,
          isCreditConsumed: false,
        },
      });
    } else if (!wasConsumed && shouldBeConsumed) {
      // Previously not consumed, now should be consumed
      await tx.creditLedger.create({
        data: {
          packageId: session.packageId,
          subjectId: session.subjectId,
          eventType: "SESSION_CONSUMED",
          creditsDelta: -1,
          sessionId: session.id,
          reason: `Attendance corrected from ${record.sessionOutcome} to ${newOutcome}: ${reason}`,
          actorRole: user.role,
          actorName: user.name,
        },
      });

      await tx.session.update({
        where: { id: session.id },
        data: {
          status: newOutcome,
          isCreditConsumed: true,
        },
      });
    } else {
      // Just update status
      await tx.session.update({
        where: { id: session.id },
        data: {
          status: newOutcome,
        },
      });
    }

    // Update attendance record
    const updatedRecord = await tx.attendanceRecord.update({
      where: { id: record.id },
      data: {
        sessionOutcome: newOutcome,
        studentAttendance: newAttendance,
        isReversed: wasConsumed && !shouldBeConsumed,
        reversalReason: wasConsumed && !shouldBeConsumed ? reason : record.reversalReason,
        reversedAt: wasConsumed && !shouldBeConsumed ? new Date() : record.reversedAt,
        reversedByName: wasConsumed && !shouldBeConsumed ? user.name : record.reversedByName,
      },
    });

    return updatedRecord;
  });
}
