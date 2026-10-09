import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";

export const GET = withErrorHandling("GET /api/mobile/admin/dashboard", async () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

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
        scheduledStartTimeUtc: { gte: startOfDay, lte: endOfDay },
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
        markedAt: { gte: startOfMonth },
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
