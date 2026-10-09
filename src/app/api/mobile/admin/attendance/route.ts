import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { canCorrectAttendance, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";

export const GET = withErrorHandling("GET /api/mobile/admin/attendance", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canCorrectAttendance(user.role));
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "RECENT"; // "MISSING" | "TODAY" | "RECENT"

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  let whereClause: any = {};

  if (filter === "MISSING") {
    whereClause = {
      scheduledEndTimeUtc: { lt: now },
      attendance: null,
      status: "SCHEDULED",
    };
  } else if (filter === "TODAY") {
    whereClause = {
      scheduledStartTimeUtc: { gte: startOfDay, lte: endOfDay },
    };
  }

  const sessions = await prisma.session.findMany({
    where: whereClause,
    include: {
      student: { select: { id: true, name: true, grade: true, studentCode: true } },
      teacher: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, color: true } },
      attendance: true,
    },
    orderBy: { scheduledStartTimeUtc: "desc" },
    take: 50,
  });

  const [missingCount, todayCount] = await Promise.all([
    prisma.session.count({
      where: { scheduledEndTimeUtc: { lt: now }, attendance: null, status: "SCHEDULED" },
    }),
    prisma.session.count({
      where: { scheduledStartTimeUtc: { gte: startOfDay, lte: endOfDay } },
    }),
  ]);

  return NextResponse.json({
    success: true,
    stats: {
      missingAttendanceCount: missingCount,
      todayClassesCount: todayCount,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      studentName: s.student.name,
      studentGrade: s.student.grade,
      teacherName: s.teacher.name,
      subjectName: s.subject.name,
      subjectColor: s.subject.color,
      startTime: s.scheduledStartTimeUtc.toISOString(),
      endTime: s.scheduledEndTimeUtc.toISOString(),
      durationMinutes: s.durationMinutes,
      status: s.status,
      isMarked: Boolean(s.attendance),
      attendanceOutcome: s.attendance?.sessionOutcome ?? null,
      studentAttendance: s.attendance?.studentAttendance ?? null,
      topicCovered: s.attendance?.topicCovered ?? null,
    })),
  });
});

export const POST = withErrorHandling("POST /api/mobile/admin/attendance", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canCorrectAttendance(user.role));
  const body = await req.json();
  const { sessionId, sessionOutcome, studentAttendance, topicCovered, durationMinutes } = body;

  if (!sessionId || !sessionOutcome) {
    return NextResponse.json({ success: false, message: "Session ID and outcome are required" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { attendance: true },
  });

  if (!session) {
    return NextResponse.json({ success: false, message: "Session not found" }, { status: 404 });
  }

  if (session.attendance) {
    const updated = await prisma.attendanceRecord.update({
      where: { sessionId },
      data: {
        sessionOutcome,
        studentAttendance: studentAttendance || "PRESENT",
        topicCovered: topicCovered || "Class completed",
        actualDurationMinutes: durationMinutes || session.durationMinutes || 60,
      },
    });
    return NextResponse.json({ success: true, record: updated, message: "Attendance updated" });
  }

  const record = await prisma.attendanceRecord.create({
    data: {
      sessionId,
      sessionOutcome,
      studentAttendance: studentAttendance || "PRESENT",
      topicCovered: topicCovered || "Class completed",
      actualDurationMinutes: durationMinutes || session.durationMinutes || 60,
      markedByName: "Admin",
      markedByRole: "ADMIN",
    },
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: sessionOutcome === "COMPLETED" ? "COMPLETED" : "CANCELLED",
      isCreditConsumed: sessionOutcome === "COMPLETED",
    },
  });

  return NextResponse.json({ success: true, record, message: "Attendance marked successfully" });
});
