import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { requireMobileUser, requireOwnTrainerProfile } from "@/lib/mobile-auth";

export const GET = withErrorHandling("GET /api/mobile/trainer/dashboard", async (req) => {
  const { searchParams } = new URL(req.url);
  // Always the signed-in trainer's own profile, whatever the app asks for.
  const teacherId = requireOwnTrainerProfile(await requireMobileUser(req), searchParams.get("teacherId"));

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true, name: true, email: true, phone: true },
  });

  if (!teacher) {
    return NextResponse.json({ success: false, message: "Teacher not found." }, { status: 404 });
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

  // 1. Today's sessions
  const todaySessions = await prisma.session.findMany({
    where: {
      teacherId,
      scheduledStartTimeUtc: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      student: { select: { id: true, name: true, studentCode: true, grade: true } },
      subject: true,
      attendance: true,
    },
    orderBy: { scheduledStartTimeUtc: "asc" },
  });

  // 2. Assigned students count
  const assignedEnrolments = await prisma.subjectEnrollment.findMany({
    where: { teacherId, status: "ACTIVE" },
    select: { studentId: true },
    distinct: ["studentId"],
  });

  // 3. Completed classes and hours this month
  const monthCompleted = await prisma.attendanceRecord.findMany({
    where: {
      session: { teacherId },
      markedAt: { gte: startOfMonth },
      sessionOutcome: "COMPLETED",
    },
    select: { actualDurationMinutes: true },
  });

  const totalMinutesThisMonth = monthCompleted.reduce((acc, curr) => acc + (curr.actualDurationMinutes || 60), 0);
  const totalHoursThisMonth = (totalMinutesThisMonth / 60).toFixed(1);

  return NextResponse.json({
    success: true,
    trainer: teacher,
    stats: {
      assignedStudentsCount: assignedEnrolments.length,
      todayClassesCount: todaySessions.length,
      completedClassesThisMonth: monthCompleted.length,
      totalHoursThisMonth: Number(totalHoursThisMonth),
    },
    todaySessions: todaySessions.map((s) => ({
      id: s.id,
      studentId: s.student.id,
      studentName: s.student.name,
      studentCode: s.student.studentCode,
      grade: s.student.grade,
      subjectName: s.subject.name,
      subjectColor: s.subject.color,
      startTime: s.scheduledStartTimeUtc.toISOString(),
      endTime: s.scheduledEndTimeUtc.toISOString(),
      durationMinutes: s.durationMinutes,
      isAttendanceMarked: Boolean(s.attendance),
      attendanceOutcome: s.attendance?.sessionOutcome ?? null,
      studentAttendance: s.attendance?.studentAttendance ?? null,
      topicCovered: s.attendance?.topicCovered ?? null,
    })),
  });
});
