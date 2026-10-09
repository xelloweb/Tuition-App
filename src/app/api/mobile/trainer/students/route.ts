import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const GET = withErrorHandling("GET /api/mobile/trainer/students", async (req) => {
  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacherId");

  if (!teacherId) {
    return NextResponse.json({ success: false, message: "Teacher ID required." }, { status: 400 });
  }

  // Find all active subject enrolments for this teacher
  const enrolments = await prisma.subjectEnrollment.findMany({
    where: { teacherId, status: "ACTIVE" },
    include: {
      subject: true,
      timetableSlots: {
        where: { active: true },
      },
      student: {
        include: {
          packages: {
            where: { status: "ACTIVE" },
            include: {
              allocations: true,
              creditLedgers: true,
            },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: { student: { name: "asc" } },
  });

  // Group by student
  const studentMap = new Map<string, any>();

  for (const enr of enrolments) {
    const student = enr.student;
    if (!student || student.status !== "ACTIVE") continue;

    // Calculate subject-specific credits for this student & subject
    const activePkg = student.packages[0];
    let allocatedCredits = 0;
    let consumedCredits = 0;

    if (activePkg) {
      const subjectAlloc = activePkg.allocations.find((a: any) => a.subjectId === enr.subjectId);
      allocatedCredits = subjectAlloc?.allocatedCredits ?? 0;

      // Consumed credits from ledger for this subject
      consumedCredits = activePkg.creditLedgers
        .filter((l: any) => l.subjectId === enr.subjectId && l.eventType === "SESSION_CONSUMED")
        .reduce((sum: number, l: any) => sum + Math.abs(l.creditsDelta), 0);
    }

    const remainingCredits = Math.max(0, allocatedCredits - consumedCredits);

    if (!studentMap.has(student.id)) {
      studentMap.set(student.id, {
        id: student.id,
        name: student.name,
        studentCode: student.studentCode,
        grade: student.grade,
        board: student.board,
        country: student.country,
        whatsappNumber: student.whatsappNumber,
        preferredTimings: student.preferredTimings,
        assignedSubjects: [],
        slots: [],
      });
    }

    const entry = studentMap.get(student.id);
    entry.assignedSubjects.push({
      enrolmentId: enr.id,
      subjectId: enr.subjectId,
      subjectName: enr.subject.name,
      subjectColor: enr.subject.color,
      allocatedCredits,
      consumedCredits,
      remainingCredits,
    });

    for (const slot of enr.timetableSlots) {
      entry.slots.push({
        id: slot.id,
        weekday: slot.weekday,
        start: formatMinutes(slot.startMinutes),
        end: formatMinutes(slot.endMinutes),
        subjectName: enr.subject.name,
      });
    }
  }

  const students = Array.from(studentMap.values());

  return NextResponse.json({
    success: true,
    students,
  });
});
