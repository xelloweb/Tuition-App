import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";

export const GET = withErrorHandling("GET /api/mobile/admin/students", async (req) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.toLowerCase().trim() || "";

  const students = await prisma.student.findMany({
    where: {
      status: "ACTIVE",
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { studentCode: { contains: search } },
              { grade: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      enrolments: {
        where: { status: "ACTIVE" },
        include: {
          subject: true,
          teacher: { select: { id: true, name: true } },
        },
      },
      packages: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  return NextResponse.json({
    success: true,
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      studentCode: s.studentCode,
      grade: s.grade,
      board: s.board,
      guardianName: s.guardianName,
      whatsappNumber: s.whatsappNumber,
      country: s.country,
      activePackage: s.packages[0] ? s.packages[0].name : "No active package",
      enrolledSubjects: s.enrolments.map((e) => ({
        subjectName: e.subject.name,
        subjectColor: e.subject.color,
        teacherName: e.teacher?.name ?? "Unassigned",
      })),
    })),
  });
});
