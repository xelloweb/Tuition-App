import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { canAccessFinancial, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";
import { istPeriods } from "@/lib/ist-periods";

export const GET = withErrorHandling("GET /api/mobile/admin/payouts", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canAccessFinancial(user.role));
  const teachers = await prisma.teacher.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      defaultRate: true,
    },
    orderBy: { name: "asc" },
  });

  // This month's earnings from the pay records the website's Payouts page uses:
  // each class keeps the rate for the student's grade at the time it was marked.
  const { month } = istPeriods();
  const monthItems = await prisma.payoutItem.findMany({
    where: { sessionDate: month, status: { not: "CANCELLED" } },
    select: { teacherId: true, durationMinutes: true, amount: true },
  });

  const teacherStats = teachers.map((teacher) => {
    const items = monthItems.filter((i) => i.teacherId === teacher.id);
    const totalMinutes = items.reduce((acc, curr) => acc + curr.durationMinutes, 0);
    const hours = Number((totalMinutes / 60).toFixed(1));

    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      hourlyRate: teacher.defaultRate,
      completedClassesCount: items.length,
      completedHours: hours,
      estimatedPayout: items.reduce((acc, curr) => acc + curr.amount, 0),
    };
  });

  const totalPayout = teacherStats.reduce((sum, t) => sum + t.estimatedPayout, 0);
  const totalHours = teacherStats.reduce((sum, t) => sum + t.completedHours, 0);

  return NextResponse.json({
    success: true,
    stats: {
      totalEstimatedPayout: totalPayout,
      totalTeachingHours: Number(totalHours.toFixed(1)),
      activeTrainersCount: teachers.length,
    },
    payouts: teacherStats,
  });
});
