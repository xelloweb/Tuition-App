import { prisma } from "@/lib/prisma";
import { getCurrentUser, canScheduleSessions, isUnlinkedTrainer, UNLINKED_TRAINER_MESSAGE } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { TimetableClient } from "./TimetableClient";

export const dynamic = "force-dynamic";

export default async function TimetablePage() {
  const user = await getCurrentUser();
  if (isUnlinkedTrainer(user)) return <AccessDenied message={UNLINKED_TRAINER_MESSAGE} />;
  if (user.role === "ACCOUNTS") {
    return <AccessDenied message="The timetable is available to the owner, coordinators and trainers." />;
  }

  // If teacher, only view own sessions; if coordinator/owner, view all
  const sessionWhere: any = {};
  if (user.role === "TEACHER" && user.teacherId) {
    sessionWhere.teacherId = user.teacherId;
  }

  const sessions = await prisma.session.findMany({
    where: sessionWhere,
    include: {
      student: { select: { id: true, name: true, grade: true, timeZone: true, country: true, whatsappNumber: true } },
      teacher: { select: { id: true, name: true } },
      subject: true,
      package: { select: { id: true, name: true, packageNumber: true } },
      attendance: { select: { id: true } },
    },
    orderBy: { scheduledStartTimeUtc: "asc" },
  });

  const isTeacher = user.role === "TEACHER" && Boolean(user.teacherId);
  const students = await prisma.student.findMany({
    where: isTeacher
      ? { status: "ACTIVE", enrolments: { some: { teacherId: user.teacherId!, status: "ACTIVE" } } }
      : { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      studentCode: true,
      grade: true,
      country: true,
      enrolments: {
        where: isTeacher ? { teacherId: user.teacherId!, status: "ACTIVE" } : { status: "ACTIVE" },
        select: { subjectId: true, teacherId: true },
      },
      packages: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          packageNumber: true,
          durationMinutes: true,
          expiryDate: true,
          allocations: { select: { subjectId: true } },
        },
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const teachers = await prisma.teacher.findMany({
    where: isTeacher ? { id: user.teacherId!, active: true } : { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, subjects: true },
  });

  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <TimetableClient
      sessions={sessions}
      students={students}
      teachers={teachers}
      subjects={subjects}
      canSchedule={canScheduleSessions(user.role)}
    />
  );
}
