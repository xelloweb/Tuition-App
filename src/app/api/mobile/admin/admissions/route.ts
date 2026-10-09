import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { canManageStudents, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";

export const GET = withErrorHandling("GET /api/mobile/admin/admissions", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canManageStudents(user.role));
  const [submissions, newCount, convertedCount] = await Promise.all([
    prisma.parentSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        reference: true,
        studentName: true,
        grade: true,
        board: true,
        subjectNames: true,
        guardianName: true,
        whatsappNumber: true,
        country: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.parentSubmission.count({ where: { status: "NEW" } }),
    prisma.parentSubmission.count({ where: { status: "CONVERTED" } }),
  ]);

  return NextResponse.json({
    success: true,
    applyUrl: "https://xellotuition.com/admission/apply",
    stats: {
      totalSubmissions: submissions.length,
      newSubmissions: newCount,
      convertedSubmissions: convertedCount,
    },
    submissions: submissions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
    })),
  });
});
