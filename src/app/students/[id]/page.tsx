import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  canAccessFinancial,
  canManageStudents,
  canReallocatePackages,
  canScheduleSessions,
  canViewStudent,
} from "@/lib/auth";
import { calculatePackageBalances } from "@/lib/package-calculations";
import { calculateStudentFinancialSummary } from "@/lib/billing";
import { getTimetableView } from "@/lib/services/timetable";
import { teacherPublicSelect } from "@/lib/services/students";
import { isValidTimeZone } from "@/lib/validation";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { StudentDetailClient } from "./StudentDetailClient";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser();

  const exists = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return <StudentDetailClient notFound />;
  }
  if (!(await canViewStudent(user, id))) {
    return <AccessDenied message="You can only open profiles of students assigned to you." />;
  }

  const canManage = canManageStudents(user.role);
  const showFinancial = canAccessFinancial(user.role) || user.role === "COORDINATOR";
  const isTeacher = user.role === "TEACHER";

  const student = await prisma.student.findUniqueOrThrow({
    where: { id },
    include: {
      guardian: { select: { id: true, name: true, whatsappNumber: true } },
      enrolments: {
        where: { status: "ACTIVE" },
        include: { subject: true, teacher: { select: teacherPublicSelect } },
        orderBy: { createdAt: "asc" },
      },
      packages: { select: { id: true } },
      sessions: {
        include: {
          subject: true,
          teacher: { select: { id: true, name: true } },
          attendance: true,
        },
        orderBy: { scheduledStartTimeUtc: "desc" },
      },
      invoices: showFinancial ? { include: { items: true, instalments: true }, orderBy: { issueDate: "desc" } } : false,
      payments: showFinancial ? { orderBy: { receivedDate: "desc" } } : false,
      followUps: isTeacher ? false : { orderBy: { contactDate: "desc" } },
      progressReports: {
        include: { subject: true, teacher: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const [packages, financialSummary, timetable, subjects, teachers, activity, ledger] = await Promise.all([
    Promise.all(student.packages.map((p) => calculatePackageBalances(p.id))).then((list) => list.filter(Boolean)),
    showFinancial ? calculateStudentFinancialSummary(student.id) : Promise.resolve(null),
    getTimetableView(student.id),
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true, color: true } }),
    canManage || canScheduleSessions(user.role)
      ? prisma.teacher.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, subjects: true, active: true } })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: { entityId: student.id, entityType: { in: ["STUDENT", "TIMETABLE"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.creditLedger.findMany({
      where: { packageId: { in: student.packages.map((p) => p.id) } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const cookieTz = (await cookies()).get("xello_display_tz")?.value;
  const viewerTimeZone = cookieTz && isValidTimeZone(decodeURIComponent(cookieTz)) ? decodeURIComponent(cookieTz) : "Asia/Kolkata";

  // Teachers see the profile academically: no billing, follow-ups or package prices.
  return (
    <StudentDetailClient
      student={student}
      packages={packages}
      financialSummary={financialSummary}
      timetable={timetable}
      availableSubjects={subjects}
      availableTeachers={teachers}
      activity={activity.map((a) => ({ id: a.id, action: a.action, actorName: a.actorName, createdAt: a.createdAt.toISOString(), details: a.details }))}
      ledger={ledger.map((l) => ({ id: l.id, eventType: l.eventType, creditsDelta: l.creditsDelta, reason: l.reason, actorName: l.actorName, createdAt: l.createdAt.toISOString() }))}
      viewerTimeZone={viewerTimeZone}
      permissions={{
        canManage,
        canSchedule: canScheduleSessions(user.role),
        canReallocate: canReallocatePackages(user.role),
        showFinancial,
        showFollowUps: !isTeacher,
      }}
    />
  );
}
