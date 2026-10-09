import { prisma } from "../prisma";
import { formatMinutes, WEEKDAYS } from "../zoned-time";
import { hoursToCredits } from "./manual-attendance";

export interface TrainerSubjectSchedule {
  slotId: string;
  weekday: number;
  weekdayName: string;
  startMinutes: number;
  endMinutes: number;
  timeDisplay: string;
}

export interface TrainerAssignedSubjectInfo {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectColor: string | null;
  enrolmentId: string;
  schedules: TrainerSubjectSchedule[];
  hasActivePackage: boolean;
  hasSubjectAllocation: boolean;
  allocatedCredits: number | null;
  completedClasses: number;
  remainingCredits: number | null;
  creditStatusLabel: string;
}

export interface TrainerStudentListItem {
  studentId: string;
  studentName: string;
  studentCode: string;
  grade: string;
  board: string;
  medium: string;
  country: string;
  whatsappNumber: string | null;
  assignedSubjects: TrainerAssignedSubjectInfo[];
}

export interface TrainerStudentAttendanceRecord {
  id: string;
  sessionId: string;
  subjectId: string;
  subjectName: string;
  classDate: string;
  durationMinutes: number;
  hoursCompleted: number;
  topicCovered: string | null;
  homework: string | null;
  studentProgressNote: string | null;
  markedByName: string;
  markedByRole: string;
  markedAt: string;
  canEdit: boolean;
}

export interface TrainerStudentProfileData {
  student: {
    id: string;
    studentCode: string;
    name: string;
    grade: string;
    board: string;
    medium: string;
    country: string;
    whatsappNumber: string | null;
    guardianName: string | null;
  };
  assignedSubjects: TrainerAssignedSubjectInfo[];
  attendanceHistory: TrainerStudentAttendanceRecord[];
}

/**
 * Retrieves all active students and assigned subjects for a specific trainer.
 * Implements subject-specific package credit allocation calculations:
 * - If student has active package with subject allocation -> shows allocated, completed, remaining credits.
 * - If no subject allocation -> displays "Subject Credit Allocation Not Set".
 * - Never leaks other subjects, other trainers, package prices, or financial details.
 */
export async function getTrainerMyStudents(teacherId: string): Promise<TrainerStudentListItem[]> {
  const enrolments = await prisma.subjectEnrollment.findMany({
    where: {
      teacherId,
      status: "ACTIVE",
      student: { status: "ACTIVE" },
    },
    include: {
      student: {
        select: {
          id: true,
          studentCode: true,
          name: true,
          grade: true,
          board: true,
          medium: true,
          country: true,
          whatsappNumber: true,
        },
      },
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
        },
      },
      timetableSlots: {
        where: { active: true },
        orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }],
      },
    },
    orderBy: [{ student: { name: "asc" } }, { subject: { name: "asc" } }],
  });

  if (enrolments.length === 0) return [];

  const studentIds = Array.from(new Set(enrolments.map((e) => e.student.id)));
  const subjectIds = Array.from(new Set(enrolments.map((e) => e.subject.id)));

  // Fetch active packages with allocations for these students
  const activePackages = await prisma.studentPackage.findMany({
    where: {
      studentId: { in: studentIds },
      status: "ACTIVE",
    },
    include: {
      allocations: true,
    },
  });

  // Fetch completed sessions for these students and subjects
  const completedSessions = await prisma.session.findMany({
    where: {
      studentId: { in: studentIds },
      subjectId: { in: subjectIds },
      isCreditConsumed: true,
    },
    include: {
      attendance: {
        select: { actualDurationMinutes: true },
      },
    },
  });

  // Build student map
  const studentMap = new Map<string, TrainerStudentListItem>();

  for (const enr of enrolments) {
    const s = enr.student;
    if (!studentMap.has(s.id)) {
      studentMap.set(s.id, {
        studentId: s.id,
        studentName: s.name,
        studentCode: s.studentCode,
        grade: s.grade,
        board: s.board,
        medium: s.medium,
        country: s.country,
        whatsappNumber: s.whatsappNumber,
        assignedSubjects: [],
      });
    }

    // Schedules for this enrolment/subject
    const schedules: TrainerSubjectSchedule[] = enr.timetableSlots.map((slot) => ({
      slotId: slot.id,
      weekday: slot.weekday,
      weekdayName: WEEKDAYS[slot.weekday]?.long ?? `Day ${slot.weekday}`,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      timeDisplay: `${WEEKDAYS[slot.weekday]?.long ?? `Day ${slot.weekday}`}: ${formatMinutes(slot.startMinutes)} – ${formatMinutes(slot.endMinutes)}`,
    }));

    // Find student active packages
    const studentPkgs = activePackages.filter((p) => p.studentId === s.id);
    const hasActivePackage = studentPkgs.length > 0;

    // Check subject allocations for this specific subject
    let allocatedCredits: number | null = null;
    let hasSubjectAllocation = false;

    for (const pkg of studentPkgs) {
      const match = pkg.allocations.find((a) => a.subjectId === enr.subject.id);
      if (match) {
        hasSubjectAllocation = true;
        allocatedCredits = (allocatedCredits ?? 0) + match.allocatedCredits;
      }
    }

    // Count completed classes/credits for this student and subject
    const subjectSessions = completedSessions.filter(
      (ses) => ses.studentId === s.id && ses.subjectId === enr.subject.id
    );
    let completedClasses = 0;
    for (const ses of subjectSessions) {
      const duration = ses.attendance?.actualDurationMinutes ?? ses.durationMinutes ?? 60;
      completedClasses += hoursToCredits(duration);
    }

    const remainingCredits =
      hasSubjectAllocation && allocatedCredits !== null
        ? Math.max(0, allocatedCredits - completedClasses)
        : null;

    let creditStatusLabel = "Subject Credit Allocation Not Set";
    if (hasSubjectAllocation && allocatedCredits !== null) {
      creditStatusLabel = `${allocatedCredits} classes (${remainingCredits} remaining)`;
    } else if (!hasActivePackage) {
      creditStatusLabel = "No Active Package";
    }

    studentMap.get(s.id)!.assignedSubjects.push({
      subjectId: enr.subject.id,
      subjectName: enr.subject.name,
      subjectCode: enr.subject.code,
      subjectColor: enr.subject.color,
      enrolmentId: enr.id,
      schedules,
      hasActivePackage,
      hasSubjectAllocation,
      allocatedCredits,
      completedClasses,
      remainingCredits,
      creditStatusLabel,
    });
  }

  return Array.from(studentMap.values());
}

/**
 * Retrieves the subject-specific student profile data for a trainer.
 * Returns null if the trainer is not actively assigned to the student.
 */
export async function getTrainerStudentProfile(
  teacherId: string,
  studentId: string
): Promise<TrainerStudentProfileData | null> {
  const enrolments = await prisma.subjectEnrollment.findMany({
    where: {
      teacherId,
      studentId,
      status: "ACTIVE",
    },
    include: {
      student: {
        select: {
          id: true,
          studentCode: true,
          name: true,
          grade: true,
          board: true,
          medium: true,
          country: true,
          whatsappNumber: true,
          guardianName: true,
          status: true,
        },
      },
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
        },
      },
      timetableSlots: {
        where: { active: true },
        orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }],
      },
    },
    orderBy: { subject: { name: "asc" } },
  });

  if (enrolments.length === 0) return null;

  const student = enrolments[0].student;
  const subjectIds = enrolments.map((e) => e.subject.id);

  // Active packages with allocations
  const activePackages = await prisma.studentPackage.findMany({
    where: {
      studentId,
      status: "ACTIVE",
    },
    include: {
      allocations: true,
    },
  });

  // Completed sessions for these subjects
  const completedSessions = await prisma.session.findMany({
    where: {
      studentId,
      subjectId: { in: subjectIds },
      isCreditConsumed: true,
    },
    include: {
      attendance: {
        select: { actualDurationMinutes: true },
      },
    },
  });

  const assignedSubjects: TrainerAssignedSubjectInfo[] = enrolments.map((enr) => {
    const schedules: TrainerSubjectSchedule[] = enr.timetableSlots.map((slot) => ({
      slotId: slot.id,
      weekday: slot.weekday,
      weekdayName: WEEKDAYS[slot.weekday]?.long ?? `Day ${slot.weekday}`,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      timeDisplay: `${WEEKDAYS[slot.weekday]?.long ?? `Day ${slot.weekday}`}: ${formatMinutes(slot.startMinutes)} – ${formatMinutes(slot.endMinutes)}`,
    }));

    let allocatedCredits: number | null = null;
    let hasSubjectAllocation = false;

    for (const pkg of activePackages) {
      const match = pkg.allocations.find((a) => a.subjectId === enr.subject.id);
      if (match) {
        hasSubjectAllocation = true;
        allocatedCredits = (allocatedCredits ?? 0) + match.allocatedCredits;
      }
    }

    const subjectSessions = completedSessions.filter((s) => s.subjectId === enr.subject.id);
    let completedClasses = 0;
    for (const s of subjectSessions) {
      const duration = s.attendance?.actualDurationMinutes ?? s.durationMinutes ?? 60;
      completedClasses += hoursToCredits(duration);
    }

    const remainingCredits =
      hasSubjectAllocation && allocatedCredits !== null
        ? Math.max(0, allocatedCredits - completedClasses)
        : null;

    let creditStatusLabel = "Subject Credit Allocation Not Set";
    if (hasSubjectAllocation && allocatedCredits !== null) {
      creditStatusLabel = `${allocatedCredits} classes (${remainingCredits} remaining)`;
    } else if (activePackages.length === 0) {
      creditStatusLabel = "No Active Package";
    }

    return {
      subjectId: enr.subject.id,
      subjectName: enr.subject.name,
      subjectCode: enr.subject.code,
      subjectColor: enr.subject.color,
      enrolmentId: enr.id,
      schedules,
      hasActivePackage: activePackages.length > 0,
      hasSubjectAllocation,
      allocatedCredits,
      completedClasses,
      remainingCredits,
      creditStatusLabel,
    };
  });

  // Attendance history for this student and these assigned subjects
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      session: {
        studentId,
        subjectId: { in: subjectIds },
      },
    },
    include: {
      session: {
        include: {
          subject: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { session: { scheduledStartTimeUtc: "desc" } },
    take: 100,
  });

  const attendanceHistory: TrainerStudentAttendanceRecord[] = attendanceRecords.map((rec) => {
    const duration = rec.actualDurationMinutes ?? rec.session.durationMinutes ?? 60;
    return {
      id: rec.id,
      sessionId: rec.sessionId,
      subjectId: rec.session.subjectId,
      subjectName: rec.session.subject.name,
      classDate: rec.session.scheduledStartTimeUtc.toISOString().slice(0, 10),
      durationMinutes: duration,
      hoursCompleted: Number((duration / 60).toFixed(1)),
      topicCovered: rec.topicCovered,
      homework: rec.homework,
      studentProgressNote: rec.studentProgressNote,
      markedByName: rec.markedByName,
      markedByRole: rec.markedByRole,
      markedAt: rec.markedAt.toISOString(),
      canEdit: rec.session.teacherId === teacherId || rec.markedByName.includes(teacherId),
    };
  });

  return {
    student: {
      id: student.id,
      studentCode: student.studentCode,
      name: student.name,
      grade: student.grade,
      board: student.board,
      medium: student.medium,
      country: student.country,
      whatsappNumber: student.whatsappNumber,
      guardianName: student.guardianName,
    },
    assignedSubjects,
    attendanceHistory,
  };
}
