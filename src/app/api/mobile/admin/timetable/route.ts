import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { canScheduleSessions, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${period}`;
}

export const GET = withErrorHandling("GET /api/mobile/admin/timetable", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canScheduleSessions(user.role));
  const slots = await prisma.timetableSlot.findMany({
    where: { active: true },
    include: {
      enrolment: {
        include: {
          student: { select: { id: true, name: true, grade: true, studentCode: true } },
          subject: { select: { id: true, name: true, color: true } },
        },
      },
      teacher: { select: { id: true, name: true } },
    },
    orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }],
  });

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const grouped = weekdays.map((dayName, index) => {
    const daySlots = slots.filter((s) => s.weekday === index);
    return {
      weekday: index,
      dayName,
      count: daySlots.length,
      slots: daySlots.map((s) => ({
        id: s.id,
        weekday: s.weekday,
        startTime: formatMinutes(s.startMinutes),
        endTime: formatMinutes(s.endMinutes),
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        studentName: s.enrolment.student.name,
        studentGrade: s.enrolment.student.grade,
        studentCode: s.enrolment.student.studentCode,
        subjectName: s.enrolment.subject.name,
        subjectColor: s.enrolment.subject.color,
        teacherName: s.teacher?.name || "Unassigned",
      })),
    };
  });

  return NextResponse.json({
    success: true,
    totalActiveSlots: slots.length,
    schedule: grouped,
  });
});
