import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { canManageStudents, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";
import { istPeriods } from "@/lib/ist-periods";

export const GET = withErrorHandling("GET /api/mobile/admin/dashboard", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canManageStudents(user.role));
  const now = new Date();
  // Days and months start at IST midnight, whatever clock the server uses.
  const { today, month } = istPeriods(now);

  const [
    totalStudents,
    totalTeachers,
    todaySessions,
    monthAttendance,
    missingAttendance,
  ] = await Promise.all([
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.teacher.count({ where: { active: true } }),
    prisma.session.findMany({
      where: {
        scheduledStartTimeUtc: today,
      },
      include: {
        student: { select: { id: true, name: true, grade: true } },
        teacher: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, color: true } },
        attendance: true,
      },
      orderBy: { scheduledStartTimeUtc: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        markedAt: month,
        sessionOutcome: "COMPLETED",
      },
      select: { actualDurationMinutes: true },
    }),
    prisma.session.count({
      where: {
        scheduledEndTimeUtc: { lt: now },
        attendance: null,
        status: "SCHEDULED",
      },
    }),
  ]);

  const totalMinutesThisMonth = monthAttendance.reduce((acc, curr) => acc + (curr.actualDurationMinutes || 60), 0);
  const totalHoursThisMonth = (totalMinutesThisMonth / 60).toFixed(1);

  return NextResponse.json({
    success: true,
    stats: {
      totalStudents,
      totalTeachers,
      todayClassesCount: todaySessions.length,
      missingAttendanceCount: missingAttendance,
      completedClassesThisMonth: monthAttendance.length,
      totalHoursThisMonth: Number(totalHoursThisMonth),
    },
    todaySessions: todaySessions.map((s) => ({
      id: s.id,
      studentName: s.student.name,
      teacherName: s.teacher.name,
      subjectName: s.subject.name,
      subjectColor: s.subject.color,
      startTime: s.scheduledStartTimeUtc.toISOString(),
      endTime: s.scheduledEndTimeUtc.toISOString(),
      isAttendanceMarked: Boolean(s.attendance),
      status: s.status,
    })),
  });
});
