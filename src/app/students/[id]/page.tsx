import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculatePackageBalances } from "@/lib/package-calculations";
import { calculateStudentFinancialSummary } from "@/lib/billing";
import { StudentDetailClient } from "./StudentDetailClient";

export default async function StudentDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      guardian: true,
      enrolments: {
        include: { subject: true, teacher: true },
      },
      packages: {
        include: {
          allocations: { include: { subject: true } },
          sessions: { include: { subject: true } },
        },
      },
      sessions: {
        include: {
          subject: true,
          teacher: true,
          attendance: true,
        },
        orderBy: { scheduledStartTimeUtc: "desc" },
      },
      invoices: {
        include: { items: true, instalments: true },
        orderBy: { issueDate: "desc" },
      },
      payments: {
        orderBy: { receivedDate: "desc" },
      },
      followUps: {
        orderBy: { contactDate: "desc" },
      },
      progressReports: {
        include: { subject: true, teacher: true },
        orderBy: { createdAt: "desc" },
      },
      assessments: {
        include: { subject: true, teacher: true },
        orderBy: { testDate: "desc" },
      },
      parentConcerns: {
        orderBy: { reportedDate: "desc" },
      },
    },
  });

  if (!student) {
    notFound();
  }

  // Calculate detailed balances for each package
  const detailedPackages: any[] = [];
  for (const pkg of student.packages) {
    const balances = await calculatePackageBalances(pkg.id);
    if (balances) {
      detailedPackages.push(balances);
    }
  }

  const financialSummary = await calculateStudentFinancialSummary(student.id);

  return (
    <StudentDetailClient
      student={student}
      packages={detailedPackages}
      financialSummary={financialSummary}
    />
  );
}
