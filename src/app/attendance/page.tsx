import { prisma } from "@/lib/prisma";
import { getCurrentUser, canCorrectAttendance, canViewTeacherRates } from "@/lib/auth";
import { getTeacherRateForGrade } from "@/lib/rates";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { AttendanceClient } from "./AttendanceClient";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (user.role === "ACCOUNTS") {
    return <AccessDenied message="Attendance is managed by trainers and academic coordinators." />;
  }
  const now = new Date();

  // If teacher, filter sessions to own; otherwise show all
  const sessionWhere: any = {
    scheduledStartTimeUtc: { lt: now },
    status: "SCHEDULED",
  };

  const recordWhere: any = {};

  if (user.role === "TEACHER" && user.teacherId) {
    sessionWhere.teacherId = user.teacherId;
    recordWhere.session = { teacherId: user.teacherId };
  }

  const missingSessions = await prisma.session.findMany({
    where: sessionWhere,
    include: {
      student: true,
      teacher: true,
      subject: true,
      package: true,
    },
    orderBy: { scheduledStartTimeUtc: "desc" },
  });

  const allRecords = await prisma.attendanceRecord.findMany({
    where: recordWhere,
    include: {
      session: {
        include: {
          student: true,
          teacher: true,
          subject: true,
        },
      },
    },
    orderBy: { markedAt: "desc" },
  });

  // Pay rates leave the server only for roles allowed to see that trainer's rate.
  const rateFor = (teacher: { id: string; defaultRate: number; gradeRates: string | null }, grade: string) =>
    canViewTeacherRates(user.role, user.teacherId, teacher.id) ? getTeacherRateForGrade(teacher, grade) : null;
  const publicTeacher = (t: { id: string; name: string }) => ({ id: t.id, name: t.name });

  const sessionsForClient = missingSessions.map((s) => ({
    ...s,
    teacher: publicTeacher(s.teacher),
    hourlyRate: rateFor(s.teacher, s.student.grade),
  }));
  const recordsForClient = allRecords.map((r) => ({
    ...r,
    session: { ...r.session, teacher: publicTeacher(r.session.teacher) },
    hourlyRate: rateFor(r.session.teacher, r.session.student.grade),
  }));

  return (
    <AttendanceClient
      missingSessions={sessionsForClient}
      allRecords={recordsForClient}
      teacherAbsences={recordsForClient.filter((r) => r.sessionOutcome === "TEACHER_NO_SHOW")}
      currentUserRole={user.role}
      canCorrect={canCorrectAttendance(user.role)}
    />
  );
}
