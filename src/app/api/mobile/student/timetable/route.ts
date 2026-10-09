import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const GET = withErrorHandling("GET /api/mobile/student/timetable", async (req) => {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ success: false, message: "Student ID required." }, { status: 400 });
  }

  const slots = await prisma.timetableSlot.findMany({
    where: {
      enrolment: { studentId },
      active: true,
    },
    include: {
      enrolment: {
        include: {
          subject: true,
          teacher: { select: { id: true, name: true, phone: true } },
        },
      },
      teacher: { select: { id: true, name: true, phone: true } },
    },
    orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }],
  });

  return NextResponse.json({
    success: true,
    slots: slots.map((s) => {
      const teacher = s.teacher ?? s.enrolment.teacher;
      return {
        id: s.id,
        weekday: s.weekday,
        start: formatMinutes(s.startMinutes),
        end: formatMinutes(s.endMinutes),
        timeZone: s.timeZone,
        subjectId: s.enrolment.subject.id,
        subjectName: s.enrolment.subject.name,
        subjectColor: s.enrolment.subject.color,
        teacherName: teacher?.name ?? "Assigned soon",
      };
    }),
  });
});
