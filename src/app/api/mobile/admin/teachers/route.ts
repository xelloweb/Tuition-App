import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { canViewAllStudents, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";

export const GET = withErrorHandling("GET /api/mobile/admin/teachers", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canViewAllStudents(user.role));
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.toLowerCase().trim() || "";

  const teachers = await prisma.teacher.findMany({
    where: {
      active: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { subjects: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      enrolments: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    success: true,
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      phone: t.phone,
      subjects: t.subjects,
      grades: t.grades,
      country: t.country,
      activeStudentsCount: t.enrolments.length,
    })),
  });
});
