import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { canManageStudents } from "../auth";
import { ApiError, conflictError, forbiddenError, notFoundError, validationError } from "../api-errors";
import { calculatePackageBalances } from "../package-calculations";
import { getTeacherRateForGrade } from "../rates";
import { BUSINESS_TIME_ZONE } from "../constants";
import { zonedTimeToUtc } from "../zoned-time";

export interface RecordManualAttendanceInput {
  studentId: string;
  subjectId: string;
  teacherId?: string;
  classDate: string; // YYYY-MM-DD
  durationMinutes: number; // 60, 120, 180, etc.
  topicCovered?: string;
  homework?: string;
  studentProgressNote?: string;
  confirmExceedsCredits?: boolean;
  confirmDuplicate?: boolean;
}

export interface EditManualAttendanceInput {
  attendanceId: string;
  durationMinutes?: number;
  classDate?: string;
  topicCovered?: string;
  homework?: string;
  studentProgressNote?: string;
  reason?: string;
}

export function hoursToCredits(durationMinutes: number): number {
  return Math.max(1, Math.round(durationMinutes / 60));
}

/**
 * Records manual attendance for a student and subject.
 * - Manually marked by Trainer, Coordinator, or Admin.
 * - Automatically deducts package credits: 1 hr = 1 credit, 2 hr = 2 credits, 3 hr = 3 credits.
 * - Automatically logs trainer working hours and payout amount.
 * - Enforces validations and duplicate safeguards.
 */
export async function recordManualAttendance(
  input: RecordManualAttendanceInput,
  user: CurrentUser
) {
  const {
    studentId,
    subjectId,
    classDate,
    durationMinutes,
    topicCovered,
    homework,
    studentProgressNote,
    confirmExceedsCredits = false,
  } = input;

  if (!studentId) throw validationError("Please select a student.");
  if (!subjectId) throw validationError("Please select a subject.");
  if (!classDate || !/^\d{4}-\d{2}-\d{2}$/.test(classDate)) {
    throw validationError("Please provide a valid class date in YYYY-MM-DD format.");
  }
  if (!durationMinutes || durationMinutes <= 0) {
    throw validationError("Please specify a valid class duration.");
  }

  // Determine teacherId based on role
  let teacherId = input.teacherId;
  if (user.role === "TEACHER") {
    if (!user.teacherId) {
      throw forbiddenError("Your account is not linked to an active trainer profile.");
    }
    teacherId = user.teacherId;
  } else if (!teacherId) {
    // If coordinator/admin did not supply teacherId, find assigned trainer for this enrolment
    const enrolment = await prisma.subjectEnrollment.findUnique({
      where: { studentId_subjectId: { studentId, subjectId } },
      select: { teacherId: true },
    });
    if (enrolment?.teacherId) {
      teacherId = enrolment.teacherId;
    } else {
      throw validationError("Please select a trainer for this class.");
    }
  }

  // Verify authorization
  if (user.role === "TEACHER") {
    // Trainer can only mark for their assigned students and assigned subjects
    const enrolment = await prisma.subjectEnrollment.findUnique({
      where: { studentId_subjectId: { studentId, subjectId } },
    });
    if (!enrolment || enrolment.teacherId !== user.teacherId || enrolment.status !== "ACTIVE") {
      throw forbiddenError("You can only mark attendance for students and subjects assigned to you.");
    }
  } else if (!canManageStudents(user.role)) {
    throw forbiddenError("Only trainers, coordinators, and admins can mark attendance.");
  }

  // Credits to deduct: 1 hr = 1 credit, 2 hr = 2 credits, 3 hr = 3 credits
  const creditsToDeduct = hoursToCredits(durationMinutes);

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch student with active packages and teacher
    const student = await tx.student.findUnique({
      where: { id: studentId },
      include: {
        packages: {
          where: { status: "ACTIVE" },
          include: { allocations: true },
          orderBy: { startDate: "desc" },
        },
      },
    });
    if (!student) throw notFoundError("Student not found.");

    const teacher = await tx.teacher.findUnique({
      where: { id: teacherId! },
    });
    if (!teacher) throw notFoundError("Trainer not found.");

    // Select the best active package (prioritize package with allocation for this subject)
    let selectedPackage = student.packages.find((p) =>
      p.allocations.some((a) => a.subjectId === subjectId && a.allocatedCredits > 0)
    );
    if (!selectedPackage && student.packages.length > 0) {
      selectedPackage = student.packages[0];
    }

    if (!selectedPackage) {
      throw validationError(
        "Student has no active package. Please purchase or assign an active package before marking attendance."
      );
    }

    // 2. Check package remaining credits
    const balances = await calculatePackageBalances(selectedPackage.id, tx);
    const remainingCredits = balances?.totalRemaining ?? 0;

    if (creditsToDeduct > remainingCredits && !confirmExceedsCredits) {
      throw new ApiError(
        400,
        "CONFLICT",
        `Marking this class (${creditsToDeduct} credit${creditsToDeduct > 1 ? "s" : ""}) exceeds the student's remaining package balance (${remainingCredits} remaining). Please confirm to proceed.`,
        {
          details: {
            code: "EXCEEDS_PACKAGE_CREDITS",
            remainingCredits,
            requiredCredits: creditsToDeduct,
            packageNumber: selectedPackage.packageNumber,
          },
        }
      );
    }

    // 3. Compute class UTC start and end times in IST
    const now = new Date();
    // Default to noon IST on chosen date
    const startTimeUtc = zonedTimeToUtc(classDate, 12 * 60, BUSINESS_TIME_ZONE);
    const endTimeUtc = new Date(startTimeUtc.getTime() + durationMinutes * 60000);

    // 4. Check for duplicate submission on the exact same date & student & subject & trainer
    const dayStartUtc = zonedTimeToUtc(classDate, 0, BUSINESS_TIME_ZONE);
    const dayEndUtc = zonedTimeToUtc(classDate, 24 * 60, BUSINESS_TIME_ZONE);
    const duplicate = await tx.session.findFirst({
      where: {
        studentId,
        subjectId,
        teacherId: teacher.id,
        status: "COMPLETED",
        scheduledStartTimeUtc: { gte: dayStartUtc, lt: dayEndUtc },
        attendance: { isNot: null },
      },
      include: { attendance: true },
    });

    if (duplicate && !input.confirmDuplicate) {
      // If the duplicate was submitted within the last 15 seconds, return it idempotently
      if (duplicate.attendance && now.getTime() - duplicate.attendance.markedAt.getTime() < 15000) {
        return {
          success: true,
          alreadyProcessed: true,
          attendanceId: duplicate.attendance.id,
          sessionId: duplicate.id,
          message: "Attendance was already submitted for this class; no duplicate was created.",
          remainingCredits,
        };
      }
      throw new ApiError(
        409,
        "DUPLICATE",
        `Attendance for ${student.name} in this subject was already marked on ${classDate}. If this is a separate class session on the same day, please confirm.`,
        { details: { code: "DUPLICATE_ATTENDANCE", existingAttendanceId: duplicate.attendance?.id } }
      );
    }

    // 5. Create Session (completed, isCreditConsumed: true)
    const session = await tx.session.create({
      data: {
        packageId: selectedPackage.id,
        studentId,
        teacherId: teacher.id,
        subjectId,
        scheduledStartTimeUtc: startTimeUtc,
        scheduledEndTimeUtc: endTimeUtc,
        durationMinutes,
        status: "COMPLETED",
        isCreditReserved: false,
        isCreditConsumed: true,
      },
    });

    // 6. Create AttendanceRecord
    const attendance = await tx.attendanceRecord.create({
      data: {
        sessionId: session.id,
        sessionOutcome: "COMPLETED",
        studentAttendance: "PRESENT",
        actualDurationMinutes: durationMinutes,
        topicCovered: topicCovered?.trim() || "Class completed",
        homework: homework?.trim() || null,
        studentProgressNote: studentProgressNote?.trim() || null,
        markedByRole: user.role,
        markedByName: user.name,
        markedAt: now,
      },
    });

    // 7. Deduct package credits in CreditLedger
    await tx.creditLedger.create({
      data: {
        packageId: selectedPackage.id,
        subjectId,
        eventType: "SESSION_CONSUMED",
        creditsDelta: -creditsToDeduct,
        resultingRemaining: remainingCredits - creditsToDeduct,
        sessionId: session.id,
        reason: `Manual attendance: ${creditsToDeduct} credit(s) consumed (${durationMinutes / 60} hr(s))`,
        actorRole: user.role,
        actorName: user.name,
        metadata: JSON.stringify({
          durationMinutes,
          creditsDeducted: creditsToDeduct,
          classDate,
          markedBy: user.name,
        }),
      },
    });

    // 8. Create Trainer PayoutItem (immediately updates trainer working hours & salary calculation)
    const ratePerHour = getTeacherRateForGrade(teacher, student.grade);
    const amount = Math.round((ratePerHour * durationMinutes) / 60);

    await tx.payoutItem.create({
      data: {
        teacherId: teacher.id,
        sessionId: session.id,
        sessionDate: startTimeUtc,
        durationMinutes,
        rateSnapshot: ratePerHour,
        amount,
        status: "APPROVED",
        notes: `${student.grade} standard rate: ₹${ratePerHour}/hr × ${(durationMinutes / 60).toFixed(1)} hrs = ₹${amount} earned (Manual attendance marked by ${user.name})`,
      },
    });

    // 9. Audit log entry
    await tx.auditLog.create({
      data: {
        entityType: "ATTENDANCE",
        entityId: attendance.id,
        action: "RECORD_MANUAL_ATTENDANCE",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          studentId,
          studentName: student.name,
          subjectId,
          teacherId: teacher.id,
          teacherName: teacher.name,
          classDate,
          durationMinutes,
          creditsDeducted: creditsToDeduct,
          packageId: selectedPackage.id,
          packageNumber: selectedPackage.packageNumber,
        }),
      },
    });

    return {
      success: true,
      alreadyProcessed: false,
      attendanceId: attendance.id,
      sessionId: session.id,
      creditsDeducted: creditsToDeduct,
      remainingCredits: remainingCredits - creditsToDeduct,
      hoursRecorded: durationMinutes / 60,
      message: `Attendance confirmed for ${student.name}. ${creditsToDeduct} class credit(s) deducted from package.`,
    };
  });
}

/**
 * Edits an existing attendance entry.
 * Automatically recalculates:
 * - Package credits delta (restoring or deducting difference)
 * - Trainer working hours & salary calculation
 */
export async function editManualAttendance(
  input: EditManualAttendanceInput,
  user: CurrentUser
) {
  const { attendanceId, durationMinutes, classDate, topicCovered, homework, studentProgressNote, reason } = input;

  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId },
    include: {
      session: {
        include: {
          package: true,
          student: true,
          teacher: true,
          payoutItems: true,
        },
      },
    },
  });

  if (!record) throw notFoundError("Attendance record not found.");

  // Check authorization: Owner, Coordinator, or the Teacher who taught / marked the class
  const isTeacher = user.role === "TEACHER" && user.teacherId === record.session.teacherId;
  const isMarkedByUser = record.markedByName === user.name;
  if (!canManageStudents(user.role) && !isTeacher && !isMarkedByUser) {
    throw forbiddenError("You are not authorized to edit this attendance record.");
  }

  const oldDuration = record.actualDurationMinutes || record.session.durationMinutes || 60;
  const newDuration = durationMinutes ?? oldDuration;
  const oldCredits = hoursToCredits(oldDuration);
  const newCredits = hoursToCredits(newDuration);
  const creditsDelta = oldCredits - newCredits; // e.g. 2 - 1 = +1 (restores 1 credit); 1 - 2 = -1 (deducts 1 credit)

  return await prisma.$transaction(async (tx) => {
    // 1. Update Session and AttendanceRecord
    let updatedStartTime = record.session.scheduledStartTimeUtc;
    if (classDate && /^\d{4}-\d{2}-\d{2}$/.test(classDate)) {
      updatedStartTime = zonedTimeToUtc(classDate, 12 * 60, BUSINESS_TIME_ZONE);
    }
    const updatedEndTime = new Date(updatedStartTime.getTime() + newDuration * 60000);

    await tx.session.update({
      where: { id: record.sessionId },
      data: {
        durationMinutes: newDuration,
        scheduledStartTimeUtc: updatedStartTime,
        scheduledEndTimeUtc: updatedEndTime,
      },
    });

    const updatedAttendance = await tx.attendanceRecord.update({
      where: { id: record.id },
      data: {
        actualDurationMinutes: newDuration,
        topicCovered: topicCovered !== undefined ? topicCovered.trim() : record.topicCovered,
        homework: homework !== undefined ? (homework.trim() || null) : record.homework,
        studentProgressNote: studentProgressNote !== undefined ? (studentProgressNote.trim() || null) : record.studentProgressNote,
      },
    });

    // 2. Adjust CreditLedger if credits changed
    if (creditsDelta !== 0) {
      await tx.creditLedger.create({
        data: {
          packageId: record.session.packageId,
          subjectId: record.session.subjectId,
          eventType: creditsDelta > 0 ? "SESSION_REVERSED" : "SESSION_CONSUMED",
          creditsDelta,
          sessionId: record.sessionId,
          reason: `Attendance edited by ${user.name}: duration changed from ${oldDuration / 60}h to ${newDuration / 60}h${reason ? ` (${reason})` : ""}`,
          actorRole: user.role,
          actorName: user.name,
        },
      });
    }

    // 3. Update PayoutItem (Trainer working hours & salary calculation)
    const payout = record.session.payoutItems[0];
    if (payout) {
      if (payout.status !== "PAID" && !payout.payoutRunId) {
        const newAmount = Math.round((payout.rateSnapshot * newDuration) / 60);
        await tx.payoutItem.update({
          where: { id: payout.id },
          data: {
            durationMinutes: newDuration,
            sessionDate: updatedStartTime,
            amount: newAmount,
            notes: `${record.session.student.grade} standard rate: ₹${payout.rateSnapshot}/hr × ${(newDuration / 60).toFixed(1)} hrs = ₹${newAmount} earned (Updated by ${user.name})`,
          },
        });
      } else {
        await tx.auditLog.create({
          data: {
            entityType: "PAYOUT_ITEM",
            entityId: payout.id,
            action: "MANUAL_PAYOUT_ADJUSTMENT_REQUIRED",
            actorRole: user.role,
            actorName: user.name,
            details: JSON.stringify({
              sessionId: record.sessionId,
              payoutId: payout.id,
              oldDuration,
              newDuration,
              reason: "Attendance duration modified after payout was batched or paid.",
            }),
          },
        });
      }
    }

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        entityType: "ATTENDANCE",
        entityId: record.id,
        action: "EDIT_ATTENDANCE",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          sessionId: record.sessionId,
          oldDuration,
          newDuration,
          creditsDelta,
          reason,
        }),
      },
    });

    return {
      success: true,
      attendanceId: record.id,
      oldCredits,
      newCredits,
      creditsDelta,
      updatedAttendance,
    };
  });
}

/**
 * Deletes an attendance entry.
 * Automatically restores:
 * - Student package credits
 * - Trainer working hours & salary payout item
 */
export async function deleteManualAttendance(
  attendanceId: string,
  user: CurrentUser
) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId },
    include: {
      session: {
        include: {
          package: true,
          student: true,
          teacher: true,
          payoutItems: true,
        },
      },
    },
  });

  if (!record) throw notFoundError("Attendance record not found.");

  // Check authorization
  const isTeacher = user.role === "TEACHER" && user.teacherId === record.session.teacherId;
  const isMarkedByUser = record.markedByName === user.name;
  if (!canManageStudents(user.role) && !isTeacher && !isMarkedByUser) {
    throw forbiddenError("You are not authorized to delete this attendance record.");
  }

  const duration = record.actualDurationMinutes || record.session.durationMinutes || 60;
  const creditsToRestore = hoursToCredits(duration);

  return await prisma.$transaction(async (tx) => {
    // 1. Reverse credits in CreditLedger
    if (record.session.isCreditConsumed) {
      await tx.creditLedger.create({
        data: {
          packageId: record.session.packageId,
          subjectId: record.session.subjectId,
          eventType: "SESSION_REVERSED",
          creditsDelta: creditsToRestore,
          sessionId: record.sessionId,
          reason: `Attendance deleted by ${user.name}: restored ${creditsToRestore} credit(s)`,
          actorRole: user.role,
          actorName: user.name,
        },
      });
    }

    // 2. Remove or cancel PayoutItem
    const payout = record.session.payoutItems[0];
    if (payout) {
      if (payout.status !== "PAID" && !payout.payoutRunId) {
        await tx.payoutItem.delete({ where: { id: payout.id } });
      } else {
        await tx.payoutItem.update({
          where: { id: payout.id },
          data: {
            status: "CANCELLED",
            notes: `${payout.notes || ""} | Cancelled by attendance deletion by ${user.name}`,
          },
        });
      }
    }

    // 3. Delete AttendanceRecord and Session
    await tx.attendanceRecord.delete({ where: { id: record.id } });
    await tx.session.delete({ where: { id: record.sessionId } });

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        entityType: "ATTENDANCE",
        entityId: record.id,
        action: "DELETE_ATTENDANCE",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          sessionId: record.sessionId,
          studentName: record.session.student.name,
          subjectId: record.session.subjectId,
          teacherName: record.session.teacher.name,
          restoredCredits: creditsToRestore,
          durationMinutes: duration,
        }),
      },
    });

    return {
      success: true,
      restoredCredits: creditsToRestore,
      message: `Attendance record deleted. ${creditsToRestore} class credit(s) restored to student package.`,
    };
  });
}

/**
 * Calculates confirmed working hours for a trainer.
 */
export async function getTrainerWorkingHours(teacherId: string) {
  const payoutItems = await prisma.payoutItem.findMany({
    where: {
      teacherId,
      status: { not: "CANCELLED" },
    },
    select: { durationMinutes: true, amount: true, status: true },
  });

  const totalMinutes = payoutItems.reduce((acc, item) => acc + item.durationMinutes, 0);
  const totalHours = Number((totalMinutes / 60).toFixed(1));
  const totalClasses = payoutItems.length;

  return {
    totalMinutes,
    totalHours,
    totalClasses,
  };
}
