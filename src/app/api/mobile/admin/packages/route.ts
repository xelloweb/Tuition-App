import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
import { canReallocatePackages, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";

export const GET = withErrorHandling("GET /api/mobile/admin/packages", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canReallocatePackages(user.role));
  const packages = await prisma.studentPackage.findMany({
    include: {
      student: { select: { id: true, name: true, studentCode: true, grade: true } },
      allocations: {
        include: { subject: { select: { id: true, name: true, color: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const totalCredits = packages.reduce((sum, p) => sum + p.totalCredits, 0);
  const activePackages = packages.filter((p) => p.status === "ACTIVE").length;

  return NextResponse.json({
    success: true,
    stats: {
      totalPackages: packages.length,
      activePackages,
      totalCredits,
    },
    packages: packages.map((pkg) => ({
      id: pkg.id,
      packageNumber: pkg.packageNumber,
      name: pkg.name,
      studentName: pkg.student.name,
      studentCode: pkg.student.studentCode,
      studentGrade: pkg.student.grade,
      totalCredits: pkg.totalCredits,
      durationMinutes: pkg.durationMinutes,
      status: pkg.status,
      price: pkg.price,
      currency: pkg.currency,
      expiryDate: pkg.expiryDate ? pkg.expiryDate.toISOString() : null,
      startDate: pkg.startDate.toISOString(),
      allocations: pkg.allocations.map((a) => ({
        id: a.id,
        subjectName: a.subject.name,
        subjectColor: a.subject.color,
        allocatedCredits: a.allocatedCredits,
      })),
    })),
  });
});
