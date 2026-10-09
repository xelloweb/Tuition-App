import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";

export const GET = withErrorHandling("GET /api/mobile/student/dashboard", async (req) => {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ success: false, message: "Student ID required." }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      guardian: true,
      enrolments: {
        where: { status: "ACTIVE" },
        include: {
          subject: true,
          teacher: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      packages: {
        where: { status: "ACTIVE" },
        include: {
          allocations: { include: { subject: true } },
          sessions: {
            where: { isCreditConsumed: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!student) {
    return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });
  }

  const now = new Date();

  // Next scheduled class
  const nextSession = await prisma.session.findFirst({
    where: {
      studentId,
      scheduledStartTimeUtc: { gte: now },
      status: "SCHEDULED",
    },
    include: {
      subject: true,
      teacher: { select: { name: true } },
    },
    orderBy: { scheduledStartTimeUtc: "asc" },
  });

  // Recent attendance/classes
  const recentRecords = await prisma.attendanceRecord.findMany({
    where: {
      session: { studentId },
      isReversed: false,
    },
    include: {
      session: {
        include: { subject: true, teacher: true },
      },
    },
    orderBy: { markedAt: "desc" },
    take: 5,
  });

  const activePkg = student.packages[0];
  const totalClasses = activePkg?.totalCredits ?? 0;
  const attendedClasses = activePkg?.sessions.length ?? 0;
  const remainingClasses = Math.max(0, totalClasses - attendedClasses);

  return NextResponse.json({
    success: true,
    student: {
      id: student.id,
      name: student.name,
      studentCode: student.studentCode,
      grade: student.grade,
      board: student.board,
      guardianName: student.guardianName,
      whatsappNumber: student.whatsappNumber,
      country: student.country,
      enrolledSubjects: student.enrolments.map((e) => ({
        subjectId: e.subjectId,
        subjectName: e.subject.name,
        subjectColor: e.subject.color,
        teacherName: e.teacher?.name ?? "Assigned soon",
      })),
    },
    package: activePkg
      ? {
          name: activePkg.name,
          totalClasses,
          attendedClasses,
          remainingClasses,
          progressPercentage: totalClasses > 0 ? Math.min(100, Math.round((attendedClasses / totalClasses) * 100)) : 0,
        }
      : null,
    nextSession: nextSession
      ? {
          id: nextSession.id,
          subjectName: nextSession.subject.name,
          subjectColor: nextSession.subject.color,
          teacherName: nextSession.teacher.name,
          startTime: nextSession.scheduledStartTimeUtc.toISOString(),
          endTime: nextSession.scheduledEndTimeUtc.toISOString(),
          durationMinutes: nextSession.durationMinutes,
        }
      : null,
    recentClasses: recentRecords.map((ar: any) => ({
      id: ar.id,
      date: ar.markedAt.toISOString(),
      subjectName: ar.session.subject.name,
      subjectColor: ar.session.subject.color,
      teacherName: ar.session.teacher.name,
      topicCovered: ar.topicCovered,
      homework: ar.homework,
      studentProgressNote: ar.studentProgressNote,
      studentAttendance: ar.studentAttendance,
      durationMinutes: ar.actualDurationMinutes,
    })),
  });
});
