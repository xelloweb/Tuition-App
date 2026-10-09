import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  canAccessFinancial,
  canManageStudents,
  canReallocatePackages,
  canScheduleSessions,
  canViewStudent,
  canAssignExistingPayments,
  canEditPackages,
} from "@/lib/auth";
import { calculatePackageBalances } from "@/lib/package-calculations";
import { calculateStudentFinancialSummary } from "@/lib/billing";
import { getTimetableView } from "@/lib/services/timetable";
import { teacherPublicSelect } from "@/lib/services/students";
import { existingPaymentOptions, hasExistingPaymentToUse } from "@/lib/services/existing-payment-packages";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { getTrainerStudentProfile } from "@/lib/services/trainer-portal";
import { TrainerStudentProfile } from "@/components/teachers/TrainerStudentProfile";
import { StudentDetailClient } from "./StudentDetailClient";

export const dynamic = "force-dynamic";

const TABS = new Set(["overview", "subjects", "timetable", "packages", "attendance", "billing", "progress", "followups", "activity"]);

export default async function StudentDetailPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await props.params;
  const tab = (await props.searchParams).tab;
  const initialTab = typeof tab === "string" && TABS.has(tab) ? tab : undefined;
  const user = await getCurrentUser();

  const exists = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return <StudentDetailClient notFound />;
  }
  if (!(await canViewStudent(user, id))) {
    return <AccessDenied message="You can only open profiles of students currently assigned to you." />;
  }

  // Trainer view: simplified, subject-specific student profile
  if (user.role === "TEACHER") {
    if (!user.teacherId) {
      return <AccessDenied message="Your account is not linked to an active trainer profile." />;
    }
    const profileData = await getTrainerStudentProfile(user.teacherId, id);
    if (!profileData) {
      return <AccessDenied message="You can only open profiles of students currently assigned to you." />;
    }
    return (
      <TrainerStudentProfile
        student={profileData.student}
        assignedSubjects={profileData.assignedSubjects}
        attendanceHistory={profileData.attendanceHistory}
        teacherName={user.name}
        teacherId={user.teacherId}
      />
    );
  }

  const canManage = canManageStudents(user.role);
  const showFinancial = canAccessFinancial(user.role) || user.role === "COORDINATOR";
  const isTeacher = false;

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


  // Owner only: money already paid that is not yet a working package.
  const paymentOptions = canAssignExistingPayments(user.role) ? await existingPaymentOptions(id) : null;
  const existingPayment = hasExistingPaymentToUse(paymentOptions) ? paymentOptions : null;

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
      permissions={{
        canManage,
        canSchedule: canScheduleSessions(user.role),
        canReallocate: canReallocatePackages(user.role),
        canEditPackage: canEditPackages(user.role),
        showFinancial,
        showFollowUps: !isTeacher,
      }}
      existingPayment={existingPayment}
      initialTab={initialTab}
    />
  );
}
