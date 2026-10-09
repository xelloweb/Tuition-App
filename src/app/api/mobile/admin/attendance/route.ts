import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFoundError, readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { parseAttendanceBody, submitSessionAttendance } from "@/lib/attendance-ledger";
import { canCorrectAttendance, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";
import { istPeriods } from "@/lib/ist-periods";

export const GET = withErrorHandling("GET /api/mobile/admin/attendance", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canCorrectAttendance(user.role));
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "RECENT"; // "MISSING" | "TODAY" | "RECENT"

  const now = new Date();
  const { today } = istPeriods(now); // IST day

  let whereClause: any = {};

  if (filter === "MISSING") {
    whereClause = {
      scheduledEndTimeUtc: { lt: now },
      attendance: null,
      status: "SCHEDULED",
    };
  } else if (filter === "TODAY") {
    whereClause = {
      scheduledStartTimeUtc: today,
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
      where: { scheduledStartTimeUtc: today },
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

/**
 * Staff mark a class from the phone with exactly the website's rules
 * (credit deduction through the ledger, package checks, no double marking).
 * Changing attendance that is already recorded goes through the website's
 * audited "Correct attendance" flow.
 */
export const POST = withErrorHandling("POST /api/mobile/admin/attendance", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canCorrectAttendance(user.role));
  const body = await readJsonObject(req);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) throw validationError("Choose the class to mark.");
  // The phone sends no length: use the class's scheduled length, as before.
  if (body.actualDurationMinutes === undefined) {
    const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { durationMinutes: true } });
    if (!session) throw notFoundError("Class not found.");
    body.actualDurationMinutes = session.durationMinutes;
  }
  const result = await submitSessionAttendance({ sessionId, ...parseAttendanceBody(body), user });
  return NextResponse.json(result);
});
