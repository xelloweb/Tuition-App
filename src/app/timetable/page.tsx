import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { TimetableClient } from "./TimetableClient";

export default async function TimetablePage() {
  const user = await getCurrentUser();

  // If teacher, only view own sessions; if coordinator/owner, view all
  const sessionWhere: any = {};
  if (user.role === "TEACHER" && user.teacherId) {
    sessionWhere.teacherId = user.teacherId;
  }

  const sessions = await prisma.session.findMany({
    where: sessionWhere,
    include: {
      student: true,
      teacher: true,
      subject: true,
      package: true,
      attendance: true,
    },
    orderBy: { scheduledStartTimeUtc: "asc" },
  });

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    include: {
      packages: { where: { status: "ACTIVE" } },
    },
    orderBy: { name: "asc" },
  });

  const teachers = await prisma.teacher.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
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
    />
  );
}
