import { prisma } from "@/lib/prisma";
import { getCurrentUser, canManageStudents } from "@/lib/auth";
import { listStudentsFor } from "@/lib/services/students";
import { listDrafts } from "@/lib/services/admission-drafts";
import { StudentsClient } from "./StudentsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentsPage() {
  const user = await getCurrentUser();
  const canManage = canManageStudents(user.role);

  // Teachers receive only the students assigned to them (filtered on the server).
  const [students, subjects, teachers, drafts] = await Promise.all([
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
    // Admission drafts are only loaded for roles that can work on admissions.
    canManage ? listDrafts() : Promise.resolve([]),
  ]);

  return (
    <StudentsClient
      students={students}
      subjects={subjects}
      teachers={teachers}
      canAddStudent={canManage}
      drafts={drafts}
      isTeacherView={user.role === "TEACHER"}
    />
  );
}
