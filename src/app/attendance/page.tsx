import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AttendanceClient } from "./AttendanceClient";

export default async function AttendancePage() {
  const user = await getCurrentUser();
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

  const teacherAbsences = allRecords.filter(
    (r) => r.sessionOutcome === "TEACHER_NO_SHOW"
  );

  return (
    <AttendanceClient
      missingSessions={missingSessions}
      allRecords={allRecords}
      teacherAbsences={teacherAbsences}
      currentUserRole={user.role}
    />
  );
}
