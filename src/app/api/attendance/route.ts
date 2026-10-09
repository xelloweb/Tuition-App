import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { parseManualAttendanceBody, recordManualAttendance } from "@/lib/services/manual-attendance";
import { prisma } from "@/lib/prisma";

export const POST = withErrorHandling("POST /api/attendance", async (req) => {
  const user = await requireUser();
  const body = await readJsonObject(req);

  const result = await recordManualAttendance(parseManualAttendanceBody(body), user);

  return NextResponse.json(result);
});

export const GET = withErrorHandling("GET /api/attendance", async (req) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const teacherId = searchParams.get("teacherId");

  const where: any = {};
  if (studentId) where.session = { studentId };
  if (teacherId) {
    where.session = { ...where.session, teacherId };
  } else if (user.role === "TEACHER" && user.teacherId) {
    where.session = { ...where.session, teacherId: user.teacherId };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      session: {
        include: {
          student: { select: { id: true, name: true, grade: true } },
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, name: true } },
          package: { select: { id: true, packageNumber: true } },
        },
      },
    },
    orderBy: { markedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      studentId: r.session.studentId,
      studentName: r.session.student.name,
      studentGrade: r.session.student.grade,
      subjectId: r.session.subjectId,
      subjectName: r.session.subject.name,
      teacherId: r.session.teacherId,
      teacherName: r.session.teacher.name,
      packageNumber: r.session.package.packageNumber,
      classDate: r.session.scheduledStartTimeUtc.toISOString(),
      durationMinutes: r.actualDurationMinutes,
      hoursCompleted: Number((r.actualDurationMinutes / 60).toFixed(1)),
      outcome: r.sessionOutcome,
      attendance: r.studentAttendance,
      topicCovered: r.topicCovered,
      homework: r.homework,
      studentProgressNote: r.studentProgressNote,
      markedByName: r.markedByName,
      markedByRole: r.markedByRole,
      markedAt: r.markedAt.toISOString(),
    })),
  });
});
