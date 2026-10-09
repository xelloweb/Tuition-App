import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { canCorrectAttendance, canViewTeacherRates, getCurrentUser, isUnlinkedTrainer, UNLINKED_TRAINER_MESSAGE } from "@/lib/auth";
import { getTeacherRateForGrade } from "@/lib/rates";
import { listCorrectionRequests } from "@/lib/services/correction-requests";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { AttendanceClient } from "./AttendanceClient";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 100;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const user = await getCurrentUser();
  if (isUnlinkedTrainer(user)) return <AccessDenied message={UNLINKED_TRAINER_MESSAGE} />;
  if (user.role === "ACCOUNTS") {
    return <AccessDenied message="Attendance is managed by trainers and academic coordinators." />;
  }
  const { session: focusSessionId } = await searchParams;
  const now = new Date();
  const own = user.role === "TEACHER" ? { teacherId: user.teacherId! } : {};

  const [pending, records, requests, allStudentsRaw, allTrainers] = await Promise.all([
    prisma.session.findMany({
      where: { ...own, status: "SCHEDULED", scheduledStartTimeUtc: { lt: now } } satisfies Prisma.SessionWhereInput,
      include: { student: true, teacher: true, subject: true, package: { select: { packageNumber: true, noShowDeductCredit: true, cancellationNoticeHours: true } } },
      orderBy: { scheduledStartTimeUtc: "desc" },
    }),
    prisma.attendanceRecord.findMany({
      where: user.role === "TEACHER" ? { session: own } : {},
      include: {
        session: { include: { student: true, teacher: true, subject: true } },
        correctionRequests: { where: { status: "OPEN" }, select: { id: true } },
      },
      orderBy: { markedAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    listCorrectionRequests(user),
    prisma.student.findMany({
      where: user.role === "TEACHER"
        ? { enrolments: { some: { teacherId: user.teacherId!, status: "ACTIVE" } } }
        : { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        grade: true,
        enrolments: {
          where: user.role === "TEACHER"
            ? { teacherId: user.teacherId!, status: "ACTIVE" }
            : { status: "ACTIVE" },
          select: {
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.teacher.findMany({
      where: user.role === "TEACHER" && user.teacherId ? { id: user.teacherId, active: true } : { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const allStudents = allStudentsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    assignedSubjects: s.enrolments.map((e) => ({
      id: e.subject.id,
      name: e.subject.name,
      teacherId: e.teacher?.id ?? null,
      teacherName: e.teacher?.name ?? null,
    })),
  }));

  // Pay rates leave the server only for roles allowed to see that trainer's rate.
  const rateFor = (teacher: { id: string; defaultRate: number; gradeRates: string | null }, grade: string) =>
    canViewTeacherRates(user.role, user.teacherId, teacher.id) ? getTeacherRateForGrade(teacher, grade) : null;

  return (
    <AttendanceClient
      pending={pending.map((s) => ({
        id: s.id,
        start: s.scheduledStartTimeUtc.toISOString(),
        end: s.scheduledEndTimeUtc.toISOString(),
        durationMinutes: s.durationMinutes,
        student: { name: s.student.name, grade: s.student.grade },
        subject: s.subject.name,
        trainer: s.teacher.name,
        packageNumber: s.package.packageNumber,
        noShowCharges: s.package.noShowDeductCredit,
        cancellationNoticeHours: s.package.cancellationNoticeHours,
        hourlyRate: rateFor(s.teacher, s.student.grade),
      }))}
      records={records.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        start: r.session.scheduledStartTimeUtc.toISOString(),
        student: r.session.student.name,
        subject: r.session.subject.name,
        trainer: r.session.teacher.name,
        outcome: r.sessionOutcome,
        attendance: r.studentAttendance,
        topic: r.topicCovered,
        homework: r.homework,
        minutes: r.actualDurationMinutes,
        markedBy: r.markedByName,
        markedAt: r.markedAt.toISOString(),
        reversed: r.isReversed,
        openRequest: r.correctionRequests.length > 0,
      }))}
      historyLimit={HISTORY_LIMIT}
      requests={requests.map((q) => ({
        id: q.id,
        recordId: q.attendanceRecordId,
        requestedBy: q.requestedByName,
        reason: q.reason,
        requestedOutcome: q.requestedOutcome,
        requestedAttendance: q.requestedAttendance,
        status: q.status,
        resolvedBy: q.resolvedByName,
        resolutionNote: q.resolutionNote,
        createdAt: q.createdAt.toISOString(),
        student: q.attendanceRecord.session.student.name,
        subject: q.attendanceRecord.session.subject.name,
        trainer: q.attendanceRecord.session.teacher.name,
        start: q.attendanceRecord.session.scheduledStartTimeUtc.toISOString(),
        currentOutcome: q.attendanceRecord.sessionOutcome,
        currentAttendance: q.attendanceRecord.studentAttendance,
      }))}
      isTrainer={user.role === "TEACHER"}
      canCorrect={canCorrectAttendance(user.role)}
      focusSessionId={focusSessionId ?? null}
      allStudents={allStudents}
      allTrainers={allTrainers}
      currentTrainerId={user.teacherId ?? undefined}
      currentTrainerName={user.name}
    />
  );
}
