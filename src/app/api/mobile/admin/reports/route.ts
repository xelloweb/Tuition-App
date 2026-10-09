import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { canAccessFinancial, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";

export const GET = withErrorHandling("GET /api/mobile/admin/reports", async (req) => {
  const user = await requireMobileUser(req);
  // Same roles as the website's Reports page; money figures only for owner and accounts.
  requirePermission(user.role === "OWNER" || user.role === "COORDINATOR" || user.role === "ACCOUNTS");
  const showFinancial = canAccessFinancial(user.role);
  const [
    totalStudents,
    activeStudents,
    totalTrainers,
    totalInvoices,
    unpaidInvoices,
    totalSessions,
    totalSubmissions,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.teacher.count({ where: { active: true } }),
    prisma.invoice.aggregate({ _sum: { totalAmount: true, paidAmount: true, balanceDue: true } }),
    prisma.invoice.count({ where: { status: { in: ["UNPAID", "OVERDUE"] } } }),
    prisma.attendanceRecord.count({ where: { sessionOutcome: "COMPLETED" } }),
    prisma.parentSubmission.count(),
  ]);

  return NextResponse.json({
    success: true,
    metrics: {
      totalStudents,
      activeStudents,
      totalTrainers,
      totalCompletedClasses: totalSessions,
      ...(showFinancial
        ? {
            totalInvoicedRevenue: totalInvoices._sum.totalAmount || 0,
            totalCollectedRevenue: totalInvoices._sum.paidAmount || 0,
            totalPendingDues: totalInvoices._sum.balanceDue || 0,
            unpaidInvoicesCount: unpaidInvoices,
          }
        : {}),
      totalAdmissionsReceived: totalSubmissions,
    },
  });
});
