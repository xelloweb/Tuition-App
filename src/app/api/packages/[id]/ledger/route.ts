import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canViewStudent, requirePermission, requireUser } from "@/lib/auth";
import { notFoundError, withErrorHandling } from "@/lib/api-errors";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>("GET /api/packages/[id]/ledger", async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const pkg = await prisma.studentPackage.findUnique({ where: { id }, select: { studentId: true } });
  if (!pkg) throw notFoundError("Package not found.");
  requirePermission(await canViewStudent(user, pkg.studentId), "You do not have access to this package.");

  const ledgers = await prisma.creditLedger.findMany({
    where: { packageId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ledgers });
});
