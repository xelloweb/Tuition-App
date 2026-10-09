import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";

export const GET = withErrorHandling("GET /api/mobile/student/classes", async (req) => {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ success: false, message: "Student ID required." }, { status: 400 });
  }

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      session: { studentId },
    },
    include: {
      session: {
        include: {
          subject: true,
          teacher: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: { markedAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    classes: attendanceRecords.map((ar) => ({
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
      sessionOutcome: ar.sessionOutcome,
    })),
  });
});
