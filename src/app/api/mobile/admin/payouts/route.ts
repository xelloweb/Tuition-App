import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";

export const GET = withErrorHandling("GET /api/mobile/admin/payouts", async () => {
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

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

  const monthRecords = await prisma.attendanceRecord.findMany({
    where: {
      markedAt: { gte: startOfMonth },
      sessionOutcome: "COMPLETED",
    },
    include: {
      session: { select: { teacherId: true, durationMinutes: true } },
    },
  });

  const teacherStats = teachers.map((teacher) => {
    const teacherSessions = monthRecords.filter((r) => r.session.teacherId === teacher.id);
    const totalMinutes = teacherSessions.reduce((acc, curr) => acc + (curr.actualDurationMinutes || 60), 0);
    const hours = Number((totalMinutes / 60).toFixed(1));
    const rate = teacher.defaultRate || 250;
    const estimatedPayout = Math.round(hours * rate);

    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      hourlyRate: rate,
      completedClassesCount: teacherSessions.length,
      completedHours: hours,
      estimatedPayout,
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
