import { prisma } from "@/lib/prisma";
import { getCurrentUser, canManageStudents } from "@/lib/auth";
import { listStudentsFor } from "@/lib/services/students";
import { StudentsClient } from "./StudentsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentsPage() {
  const user = await getCurrentUser();
  const canManage = canManageStudents(user.role);

  // Teachers receive only the students assigned to them (filtered on the server).
  const [students, subjects, teachers] = await Promise.all([
    listStudentsFor(user),
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, color: true },
    }),
    canManage
      ? prisma.teacher.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, subjects: true, active: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <StudentsClient
      students={students}
      subjects={subjects}
      teachers={teachers}
      canAddStudent={canManage}
      isTeacherView={user.role === "TEACHER"}
    />
  );
}
