import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { PackageBalanceBreakdown, PackageStatus, SubjectBalanceCalculation } from "./types";

/**
 * Pass the transaction client when the result guards a write (scheduling,
 * reallocation) so the balance is read inside the same transaction.
 */
export async function calculatePackageBalances(
  packageId: string,
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<PackageBalanceBreakdown | null> {
  const pkg = await db.studentPackage.findUnique({
    where: { id: packageId },
    include: {
      allocations: {
        include: {
          subject: true,
        },
      },
      sessions: {
        include: {
          attendance: true,
          subject: true,
        },
      },
      invoices: {
        where: {
          status: { not: "CANCELLED" },
        },
        select: {
          paidAmount: true,
          balanceDue: true,
          totalAmount: true,
        },
      },
    },
  });

  if (!pkg) return null;

  // Calculate per-subject statistics
  const subjectMap = new Map<string, SubjectBalanceCalculation>();

  for (const alloc of pkg.allocations) {
    subjectMap.set(alloc.subjectId, {
      subjectId: alloc.subjectId,
      subjectName: alloc.subject.name,
      subjectCode: alloc.subject.code,
      subjectColor: alloc.subject.color,
      allocatedCredits: alloc.allocatedCredits,
      consumedCredits: 0,
      remainingCredits: alloc.allocatedCredits,
      reservedCredits: 0,
      availableCredits: alloc.allocatedCredits,
    });
  }

  // Iterate over sessions to calculate consumed and reserved counts
  let totalConsumed = 0;
  let totalReserved = 0;

  for (const session of pkg.sessions) {
    const subCalc = subjectMap.get(session.subjectId);

    if (session.isCreditConsumed) {
      totalConsumed++;
      if (subCalc) {
        subCalc.consumedCredits++;
      }
    } else if (session.isCreditReserved && session.status === "SCHEDULED") {
      totalReserved++;
      if (subCalc) {
        subCalc.reservedCredits++;
      }
    }
  }

  // Recalculate remaining and available
  let totalAllocated = 0;
  const subjectsArray: SubjectBalanceCalculation[] = [];

  for (const sub of subjectMap.values()) {
    sub.remainingCredits = sub.allocatedCredits - sub.consumedCredits;
    sub.availableCredits = sub.remainingCredits - sub.reservedCredits;
    totalAllocated += sub.allocatedCredits;
    subjectsArray.push(sub);
  }

  const unallocatedCredits = Math.max(0, pkg.totalCredits - totalAllocated);
  const totalRemaining = pkg.totalCredits - totalConsumed;
  const totalAvailable = totalRemaining - totalReserved;
  const paidAmount = (pkg.invoices ?? []).reduce((sum, inv) => sum + inv.paidAmount, 0);
  const balanceDue = (pkg.invoices ?? []).reduce((sum, inv) => sum + inv.balanceDue, 0);

  return {
    packageId: pkg.id,
    packageNumber: pkg.packageNumber,
    packageName: pkg.name,
    price: pkg.price,
    paidAmount,
    balanceDue,
    currency: pkg.currency,
    totalEntitlement: pkg.totalCredits,
    unallocatedCredits,
    totalAllocated,
    totalConsumed,
    totalRemaining,
    totalReserved,
    totalAvailable,
    subjects: subjectsArray,
    status: pkg.status as PackageStatus,
    startDate: pkg.startDate.toISOString(),
    expiryDate: pkg.expiryDate ? pkg.expiryDate.toISOString() : null,
  };
}
