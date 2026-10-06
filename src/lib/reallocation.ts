import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { calculatePackageBalances } from "./package-calculations";
import { CurrentUser, ReallocationValidationResult, SubjectBalanceCalculation } from "./types";
import { canReallocatePackages } from "./auth";
import { ApiError, forbiddenError, notFoundError, validationError } from "./api-errors";
import { lockPackages } from "./scheduling";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AllocationInput {
  subjectId: string;
  newAllocatedCredits: number;
}

/** Validates the request shape: integer, non-negative, one row per subject. */
export function parseAllocations(raw: unknown, unallocatedRaw: unknown): { allocations: AllocationInput[]; unallocated: number | null } {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw validationError("Provide the new allocation for each subject.");
  }
  const seen = new Set<string>();
  const allocations: AllocationInput[] = [];
  for (const item of raw) {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const subjectId = typeof row.subjectId === "string" ? row.subjectId : "";
    const credits = Number(row.newAllocatedCredits);
    if (!subjectId) throw validationError("Each allocation needs a subject.");
    if (!Number.isInteger(credits) || credits < 0) {
      throw validationError("Allocations must be whole numbers of classes, 0 or more.");
    }
    if (seen.has(subjectId)) throw validationError("Each subject can appear only once in a reallocation.");
    seen.add(subjectId);
    allocations.push({ subjectId, newAllocatedCredits: credits });
  }
  let unallocated: number | null = null;
  if (unallocatedRaw !== undefined && unallocatedRaw !== null) {
    unallocated = Number(unallocatedRaw);
    if (!Number.isInteger(unallocated) || unallocated < 0) {
      throw validationError("Unallocated classes must be a whole number, 0 or more.");
    }
  }
  return { allocations, unallocated };
}

export async function validateReallocation(
  packageId: string,
  newAllocations: AllocationInput[],
  unallocatedCredits: number | null = null,
  db: Db = prisma
): Promise<ReallocationValidationResult> {
  const currentBalances = await calculatePackageBalances(packageId, db);
  if (!currentBalances) {
    return { valid: false, errors: ["Package not found."], warnings: [], affectedSessions: [], preview: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const affectedSessions: ReallocationValidationResult["affectedSessions"] = [];
  const preview: SubjectBalanceCalculation[] = [];

  // Subjects left out of the request keep their current allocation, so the
  // entitlement check always covers the whole package.
  const proposed = new Map<string, number>(currentBalances.subjects.map((s) => [s.subjectId, s.allocatedCredits]));
  for (const a of newAllocations) proposed.set(a.subjectId, a.newAllocatedCredits);

  const newSubjectIds = newAllocations.map((a) => a.subjectId).filter((id) => !currentBalances.subjects.some((s) => s.subjectId === id));
  const newSubjects = newSubjectIds.length
    ? await db.subject.findMany({ where: { id: { in: newSubjectIds } } })
    : [];
  for (const id of newSubjectIds) {
    if (!newSubjects.some((s) => s.id === id)) errors.push("One of the subjects no longer exists. Refresh and try again.");
  }

  const totalAllocated = [...proposed.values()].reduce((a, b) => a + b, 0);
  const derivedUnallocated = currentBalances.totalEntitlement - totalAllocated;
  if (derivedUnallocated < 0 || (unallocatedCredits !== null && totalAllocated + unallocatedCredits !== currentBalances.totalEntitlement)) {
    errors.push(
      `Total proposed credits (${totalAllocated + (unallocatedCredits ?? Math.max(0, derivedUnallocated))}) must exactly equal package entitlement (${currentBalances.totalEntitlement}).`
    );
  }

  const upcomingSessions = await db.session.findMany({
    where: { packageId, status: "SCHEDULED", isCreditReserved: true, isCreditConsumed: false },
    include: { subject: true, teacher: true },
    orderBy: { scheduledStartTimeUtc: "asc" },
  });

  for (const [subjectId, allocated] of proposed) {
    const currentSub = currentBalances.subjects.find((s) => s.subjectId === subjectId);
    const newSubject = newSubjects.find((s) => s.id === subjectId);
    const consumed = currentSub?.consumedCredits || 0;
    const subjectName = currentSub?.subjectName || newSubject?.name || "Subject";

    if (allocated < consumed) {
      errors.push(
        `Allocation for ${subjectName} cannot be reduced to ${allocated} because ${consumed} credits have already been consumed.`
      );
    }

    const proposedRemaining = allocated - consumed;
    const reservedCount = currentSub?.reservedCredits || 0;
    if (reservedCount > proposedRemaining) {
      const excessCount = reservedCount - Math.max(0, proposedRemaining);
      const conflicted = upcomingSessions.filter((s) => s.subjectId === subjectId).slice(-excessCount);
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
      subjectId,
      subjectName,
      subjectCode: currentSub?.subjectCode || newSubject?.code || "",
      subjectColor: currentSub?.subjectColor || newSubject?.color || "#2563eb",
      allocatedCredits: allocated,
      consumedCredits: consumed,
      remainingCredits: proposedRemaining,
      reservedCredits: reservedCount,
      availableCredits: proposedRemaining - reservedCount,
    });
  }

  if (derivedUnallocated > 0) warnings.push(`${derivedUnallocated} class(es) will remain unallocated.`);

  return { valid: errors.length === 0, errors, warnings, affectedSessions, preview };
}

export async function executeReallocation(
  packageId: string,
  newAllocations: AllocationInput[],
  reason: string,
  user: CurrentUser,
  unallocatedCredits: number | null = null
) {
  if (!canReallocatePackages(user.role)) {
    throw forbiddenError("Unauthorized: Only Academic Coordinators and Admins can reallocate package classes.");
  }
  if (!reason || reason.trim().length < 5) {
    throw validationError("A valid reason (at least 5 characters) is required for auditable reallocation.");
  }

  // Validate and write in one transaction so attendance or bookings made in
  // between cannot invalidate the checks.
  return prisma.$transaction(async (tx) => {
    await lockPackages(tx, [packageId]);
    const currentBalances = await calculatePackageBalances(packageId, tx);
    if (!currentBalances) throw notFoundError("Package not found.");

    const validation = await validateReallocation(packageId, newAllocations, unallocatedCredits, tx);
    if (!validation.valid) {
      throw new ApiError(409, "CONFLICT", validation.errors.join(" "), {
        details: { affectedSessions: validation.affectedSessions },
      });
    }

    for (const alloc of newAllocations) {
      const currentSub = currentBalances.subjects.find((s) => s.subjectId === alloc.subjectId);
      const prevAlloc = currentSub?.allocatedCredits || 0;
      const delta = alloc.newAllocatedCredits - prevAlloc;

      await tx.subjectAllocation.upsert({
        where: { packageId_subjectId: { packageId, subjectId: alloc.subjectId } },
        update: { allocatedCredits: alloc.newAllocatedCredits },
        create: { packageId, subjectId: alloc.subjectId, allocatedCredits: alloc.newAllocatedCredits },
      });

      if (delta !== 0) {
        const consumed = currentSub?.consumedCredits || 0;
        await tx.creditLedger.create({
          data: {
            packageId,
            subjectId: alloc.subjectId,
            eventType: delta > 0 ? "REALLOCATION_IN" : "REALLOCATION_OUT",
            creditsDelta: delta,
            resultingRemaining: alloc.newAllocatedCredits - consumed,
            reason: `Reallocation from ${prevAlloc} to ${alloc.newAllocatedCredits} classes: ${reason.trim()}`,
            actorRole: user.role,
            actorName: user.name,
            metadata: JSON.stringify({ previousAllocated: prevAlloc, newAllocated: alloc.newAllocatedCredits, consumed }),
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        entityType: "PACKAGE",
        entityId: packageId,
        action: "REALLOCATE_CLASSES",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          reason: reason.trim(),
          before: currentBalances.subjects.map((s) => ({ subjectId: s.subjectId, allocated: s.allocatedCredits })),
          after: newAllocations,
        }),
      },
    });

    return { success: true };
  });
}
