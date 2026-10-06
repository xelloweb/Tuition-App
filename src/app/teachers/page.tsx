import { prisma } from "@/lib/prisma";
import { getCurrentUser, canManageTeachers, canManageTeacherRates } from "@/lib/auth";
import { listTeachersFor } from "@/lib/services/teachers";
import { TeachersClient } from "./TeachersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeachersPage() {
  const user = await getCurrentUser();

  // Teachers see only their own profile; pay rates are stripped server-side
  // for roles that may not view them.
  const [teachers, subjects] = await Promise.all([
    listTeachersFor(user),
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <TeachersClient
      teachers={teachers}
      canManage={canManageTeachers(user.role)}
      canSetRates={canManageTeacherRates(user.role)}
      currentRole={user.role}
      availableSubjects={subjects}
    />
  );
}
