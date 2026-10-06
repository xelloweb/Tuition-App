import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessAcademic } from "@/lib/auth";
import { StudentsClient } from "./StudentsClient";

export default async function StudentsPage() {
  const user = await getCurrentUser();

  const students = await prisma.student.findMany({
    include: {
      packages: {
        where: { status: "ACTIVE" },
        include: {
          sessions: { where: { isCreditConsumed: true } },
        },
      },
      enrolments: {
        include: { subject: true, teacher: true },
      },
      guardian: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
  });

  const teachers = await prisma.teacher.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return (
    <StudentsClient
      students={students}
      subjects={subjects}
      teachers={teachers}
      canAddStudent={canAccessAcademic(user.role)}
    />
  );
}
