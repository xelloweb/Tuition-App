import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { requireMobileUser, requireOwnTrainerProfile } from "@/lib/mobile-auth";

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const GET = withErrorHandling("GET /api/mobile/trainer/timetable", async (req) => {
  const { searchParams } = new URL(req.url);
  // Always the signed-in trainer's own profile, whatever the app asks for.
  const teacherId = requireOwnTrainerProfile(await requireMobileUser(req), searchParams.get("teacherId"));

  const slots = await prisma.timetableSlot.findMany({
    where: { teacherId, active: true },
    include: {
      enrolment: {
        include: {
          student: { select: { id: true, name: true, studentCode: true, grade: true } },
          subject: true,
        },
      },
    },
    orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }],
  });

  return NextResponse.json({
    success: true,
    slots: slots.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      start: formatMinutes(s.startMinutes),
      end: formatMinutes(s.endMinutes),
      timeZone: s.timeZone,
      studentId: s.enrolment.student.id,
      studentName: s.enrolment.student.name,
      studentCode: s.enrolment.student.studentCode,
      grade: s.enrolment.student.grade,
      subjectId: s.enrolment.subject.id,
      subjectName: s.enrolment.subject.name,
      subjectColor: s.enrolment.subject.color,
    })),
  });
});
