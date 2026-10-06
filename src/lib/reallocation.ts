import { prisma } from "./prisma";
import { calculatePackageBalances } from "./package-calculations";
import { CurrentUser, ReallocationValidationResult } from "./types";
import { canReallocatePackages } from "./auth";

export async function validateReallocation(
  packageId: string,
  newAllocations: { subjectId: string; newAllocatedCredits: number }[],
  unallocatedCredits = 0
): Promise<ReallocationValidationResult> {
  const currentBalances = await calculatePackageBalances(packageId);
  if (!currentBalances) {
    return {
      valid: false,
      errors: ["Package not found."],
      warnings: [],
      affectedSessions: [],
      preview: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const affectedSessions: any[] = [];
  const preview: any[] = [];

  // 1. Total allocation sum check
  const sumNewAllocations = newAllocations.reduce(
    (acc, cur) => acc + cur.newAllocatedCredits,
    0
  );
  const totalProposed = sumNewAllocations + unallocatedCredits;

  if (totalProposed !== currentBalances.totalEntitlement) {
    errors.push(
      `Total proposed credits (${totalProposed}) must exactly equal package entitlement (${currentBalances.totalEntitlement}).`
    );
  }

  // 2. Fetch upcoming reserved sessions to detect conflicts
  const upcomingSessions = await prisma.session.findMany({
    where: {
      packageId,
      status: "SCHEDULED",
      isCreditReserved: true,
      isCreditConsumed: false,
    },
    include: {
      subject: true,
      teacher: true,
    },
    orderBy: {
      scheduledStartTimeUtc: "asc",
    },
  });

  // 3. Subject-level validation
  for (const alloc of newAllocations) {
    const currentSub = currentBalances.subjects.find(
      (s) => s.subjectId === alloc.subjectId
    );

    const consumed = currentSub?.consumedCredits || 0;
    const subjectName = currentSub?.subjectName || "Subject";

    if (alloc.newAllocatedCredits < 0) {
      errors.push(`Allocation for ${subjectName} cannot be negative.`);
    }

    if (alloc.newAllocatedCredits < consumed) {
      errors.push(
        `Allocation for ${subjectName} cannot be reduced to ${alloc.newAllocatedCredits} because ${consumed} credits have already been consumed.`
      );
    }

    const proposedRemaining = alloc.newAllocatedCredits - consumed;
    const reservedCount = currentSub?.reservedCredits || 0;

    if (reservedCount > proposedRemaining) {
      // Find the excess sessions that cannot be covered
      const subSessions = upcomingSessions.filter(
        (s) => s.subjectId === alloc.subjectId
      );
      const excessCount = reservedCount - proposedRemaining;
      const conflicted = subSessions.slice(-excessCount); // The latest ones that exceed capacity

      for (const ses of conflicted) {
        affectedSessions.push({
          sessionId: ses.id,
          subjectId: ses.subjectId,
          subjectName: ses.subject.name,
          scheduledStartTimeUtc: ses.scheduledStartTimeUtc,
          teacherName: ses.teacher.name,
        });
      }

      errors.push(
        `${subjectName} has ${reservedCount} upcoming scheduled sessions, but the new allocation leaves only ${proposedRemaining} remaining classes. Please cancel or reschedule ${excessCount} session(s) before proceeding.`
      );
    }

    preview.push({
      subjectId: alloc.subjectId,
      subjectName,
      subjectCode: currentSub?.subjectCode || "",
      subjectColor: currentSub?.subjectColor || "#2563eb",
      allocatedCredits: alloc.newAllocatedCredits,
      consumedCredits: consumed,
      remainingCredits: proposedRemaining,
      reservedCredits: reservedCount,
      availableCredits: proposedRemaining - reservedCount,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    affectedSessions,
    preview,
  };
}

export async function executeReallocation(
  packageId: string,
  newAllocations: { subjectId: string; newAllocatedCredits: number }[],
  reason: string,
  user: CurrentUser,
  unallocatedCredits = 0
) {
  if (!canReallocatePackages(user.role)) {
    throw new Error("Unauthorized: Only Academic Coordinators and Admins can reallocate package classes.");
  }

  if (!reason || reason.trim().length < 5) {
    throw new Error("A valid reason (at least 5 characters) is required for auditable reallocation.");
  }

  const validation = await validateReallocation(
    packageId,
    newAllocations,
    unallocatedCredits
  );

  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const currentBalances = await calculatePackageBalances(packageId);
  if (!currentBalances) throw new Error("Package not found.");

  // Execute inside an atomic transaction
  return await prisma.$transaction(async (tx) => {
    for (const alloc of newAllocations) {
      const currentSub = currentBalances.subjects.find(
        (s) => s.subjectId === alloc.subjectId
      );
      const prevAlloc = currentSub?.allocatedCredits || 0;
      const delta = alloc.newAllocatedCredits - prevAlloc;

      // Upsert allocation
      await tx.subjectAllocation.upsert({
        where: {
          packageId_subjectId: {
            packageId,
            subjectId: alloc.subjectId,
          },
        },
        update: {
          allocatedCredits: alloc.newAllocatedCredits,
        },
        create: {
          packageId,
          subjectId: alloc.subjectId,
          allocatedCredits: alloc.newAllocatedCredits,
        },
      });

      // If allocation changed, record audit ledger entry
      if (delta !== 0) {
        const consumed = currentSub?.consumedCredits || 0;
        const newRemaining = alloc.newAllocatedCredits - consumed;

        await tx.creditLedger.create({
          data: {
            packageId,
            subjectId: alloc.subjectId,
            eventType: delta > 0 ? "REALLOCATION_IN" : "REALLOCATION_OUT",
            creditsDelta: delta,
            resultingRemaining: newRemaining,
            reason: `Reallocation from ${prevAlloc} to ${alloc.newAllocatedCredits} classes: ${reason}`,
            actorRole: user.role,
            actorName: user.name,
            metadata: JSON.stringify({
              previousAllocated: prevAlloc,
              newAllocated: alloc.newAllocatedCredits,
              consumed,
            }),
          },
        });
      }
    }

    // Audit Log
    await tx.auditLog.create({
      data: {
        entityType: "PACKAGE",
        entityId: packageId,
        action: "REALLOCATE_CLASSES",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          reason,
          allocations: newAllocations,
        }),
      },
    });

    return { success: true };
  });
}
