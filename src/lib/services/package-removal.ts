/**
 * Owner-only correction: remove a package that was created by mistake (for
 * example a "new package" made because there was no way yet to assign a package
 * using an existing payment).
 *
 * Removed: the package, its subject allocations and credit entries, its unpaid
 * invoice(s) with no payment, and classes booked on it that were never attended.
 * Kept: every payment, and every attended class, which is moved to another of
 * the student's packages chosen by the owner. A package that holds a payment
 * cannot be removed here.
 */
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { ApiError, conflictError, forbiddenError, notFoundError, validationError } from "../api-errors";

export interface PackageRemovalPreview {
  package: { id: string; packageNumber: string; name: string; status: string; totalCredits: number; createdAt: string };
  student: { id: string; name: string; studentCode: string };
  invoices: { invoiceNumber: string; totalAmount: number; paidAmount: number; status: string }[];
  /** Booked but never attended: removed with the package. */
  bookedClasses: number;
  /** Attended or charged classes: kept, moved to another package. */
  attendedClasses: { sessionId: string; start: string; subjectId: string; subjectName: string; teacherName: string }[];
  /** The student's other packages that can take every attended class (allocation for each subject). */
  moveTargets: { id: string; packageNumber: string; name: string; status: string }[];
  /** Reasons this package cannot be removed here. */
  blockers: string[];
}

export async function previewPackageRemoval(packageId: string, db: typeof prisma = prisma): Promise<PackageRemovalPreview> {
  const pkg = await db.studentPackage.findUnique({
    where: { id: packageId },
    include: {
      student: { select: { id: true, name: true, studentCode: true } },
      invoices: { include: { allocations: { select: { id: true, amount: true } } } },
      sessions: {
        include: { attendance: { select: { id: true } }, subject: { select: { name: true } }, teacher: { select: { name: true } } },
        orderBy: { scheduledStartTimeUtc: "asc" },
      },
    },
  });
  if (!pkg) throw notFoundError("This package no longer exists. Refresh the page.");

  const blockers: string[] = [];
  for (const inv of pkg.invoices) {
    if (inv.paidAmount > 0 || inv.allocations.length > 0) {
      blockers.push(
        `Invoice ${inv.invoiceNumber} has a payment linked (₹${inv.paidAmount.toLocaleString("en-IN")} paid). This package holds a real payment, so it cannot be removed here.`
      );
    }
  }

  const attended = pkg.sessions.filter((s) => s.attendance || s.isCreditConsumed);
  const subjectIds = [...new Set(attended.map((s) => s.subjectId))];
  const others = await db.studentPackage.findMany({
    where: { studentId: pkg.studentId, id: { not: pkg.id }, status: { notIn: ["CLOSED"] } },
    include: { allocations: { select: { subjectId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const moveTargets = attended.length
    ? others.filter((o) => subjectIds.every((id) => o.allocations.some((a) => a.subjectId === id)))
    : [];
  if (attended.length && moveTargets.length === 0) {
    blockers.push(
      `${attended.length} attended class${attended.length === 1 ? " is" : "es are"} recorded on this package. Set up the correct package first (for example with "Assign package using existing payment"), then come back: the attended classes will be moved to it, not deleted.`
    );
  }

  return {
    package: { id: pkg.id, packageNumber: pkg.packageNumber, name: pkg.name, status: pkg.status, totalCredits: pkg.totalCredits, createdAt: pkg.createdAt.toISOString() },
    student: pkg.student,
    invoices: pkg.invoices.map((i) => ({ invoiceNumber: i.invoiceNumber, totalAmount: i.totalAmount, paidAmount: i.paidAmount, status: i.status })),
    bookedClasses: pkg.sessions.length - attended.length,
    attendedClasses: attended.map((s) => ({
      sessionId: s.id,
      start: s.scheduledStartTimeUtc.toISOString(),
      subjectId: s.subjectId,
      subjectName: s.subject.name,
      teacherName: s.teacher.name,
    })),
    moveTargets: moveTargets.map((o) => ({ id: o.id, packageNumber: o.packageNumber, name: o.name, status: o.status })),
    blockers,
  };
}

export async function removePackage(
  packageId: string,
  input: { confirmPackageNumber?: unknown; moveAttendedTo?: unknown },
  user: CurrentUser
) {
  if (user.role !== "OWNER") throw forbiddenError("Only the owner can remove a package.");

  return prisma.$transaction(async (tx) => {
    const preview = await previewPackageRemoval(packageId, tx as unknown as typeof prisma);
    if (String(input.confirmPackageNumber ?? "").trim().toUpperCase() !== preview.package.packageNumber.toUpperCase()) {
      throw validationError("Type the package number to confirm.", { confirmPackageNumber: `Type ${preview.package.packageNumber} to confirm.` });
    }
    if (preview.blockers.length) throw conflictError(preview.blockers.join(" "));

    let movedTo: { id: string; packageNumber: string } | null = null;
    if (preview.attendedClasses.length) {
      const target = preview.moveTargets.find((t) => t.id === input.moveAttendedTo);
      if (!target) {
        throw new ApiError(400, "VALIDATION_FAILED", "Choose the package that should keep the attended classes.", {
          fieldErrors: { moveAttendedTo: "Choose the package that should keep the attended classes." },
        });
      }
      const ids = preview.attendedClasses.map((c) => c.sessionId);
      // Attended classes and their credit history move as they are; nothing about them changes.
      await tx.session.updateMany({ where: { id: { in: ids } }, data: { packageId: target.id } });
      await tx.creditLedger.updateMany({ where: { packageId, sessionId: { in: ids } }, data: { packageId: target.id } });
      movedTo = { id: target.id, packageNumber: target.packageNumber };
    }

    const invoiceIds = (await tx.invoice.findMany({ where: { packageId }, select: { id: true } })).map((i) => i.id);
    const followUps = await tx.followUp.deleteMany({ where: { OR: [{ packageId }, { invoiceId: { in: invoiceIds } }] } });
    const invoices = await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    const booked = await tx.session.deleteMany({ where: { packageId } });
    await tx.studentPackage.delete({ where: { id: packageId } });

    const details = {
      packageNumber: preview.package.packageNumber,
      packageName: preview.package.name,
      studentCode: preview.student.studentCode,
      invoicesRemoved: preview.invoices.map((i) => i.invoiceNumber),
      bookedClassesRemoved: booked.count,
      attendedClassesMoved: preview.attendedClasses.length,
      movedTo: movedTo?.packageNumber ?? null,
      followUpsRemoved: followUps.count,
    };
    await tx.auditLog.create({
      data: {
        entityType: "PACKAGE",
        entityId: packageId,
        action: "REMOVE_WRONG_PACKAGE",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify(details),
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "STUDENT",
        entityId: preview.student.id,
        action: "REMOVE_WRONG_PACKAGE",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify(details),
      },
    });

    return {
      ...details,
      invoicesRemovedCount: invoices.count,
      message: `Package ${preview.package.packageNumber} removed: ${booked.count} booked class${booked.count === 1 ? "" : "es"} and ${invoices.count} unpaid invoice${invoices.count === 1 ? "" : "s"} removed${movedTo ? `, ${preview.attendedClasses.length} attended class${preview.attendedClasses.length === 1 ? "" : "es"} moved to ${movedTo.packageNumber}` : ""}. Payments are unchanged.`,
    };
  });
}
