import { prisma } from "@/lib/prisma";
import { CurrentUser, PackageStatus } from "@/lib/types";
import { canEditPackages, requirePermission } from "@/lib/auth";
import { ApiError, notFoundError, validationError } from "@/lib/api-errors";
import { calculatePackageBalances } from "@/lib/package-calculations";
import { generateTimetableOccurrences } from "@/lib/services/timetable";

export interface EditPackageInput {
  name: string;
  totalCredits: number;
  price: number;
  startDate: string;
  expiryDate?: string | null;
  status?: string;
  notes?: string | null;
  allocations?: { subjectId: string; allocatedCredits: number }[];
  confirmFewerThanAttended?: boolean;
}

export async function getPackageDetailsWithHistory(packageId: string) {
  const pkg = await prisma.studentPackage.findUnique({
    where: { id: packageId },
    include: {
      student: { select: { id: true, name: true, studentCode: true, country: true, grade: true } },
      allocations: { include: { subject: true } },
      sessions: {
        select: {
          id: true,
          status: true,
          isCreditConsumed: true,
          attendance: { select: { studentAttendance: true, sessionOutcome: true } },
        },
      },
      invoices: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          paidAmount: true,
          balanceDue: true,
          status: true,
        },
      },
    },
  });

  if (!pkg) throw notFoundError("Package not found.");

  const balances = await calculatePackageBalances(packageId);

  const classesAttended = pkg.sessions.filter(
    (s) => s.isCreditConsumed || s.status === "COMPLETED" || (s.attendance && (s.attendance.studentAttendance === "PRESENT" || s.attendance.sessionOutcome === "COMPLETED"))
  ).length;

  const editHistory = await prisma.auditLog.findMany({
    where: {
      entityType: "PACKAGE",
      entityId: packageId,
      action: "EDIT_PACKAGE",
    },
    orderBy: { createdAt: "desc" },
  });

  const parsedHistory = editHistory.map((log) => {
    let details: any = {};
    try {
      details = JSON.parse(log.details);
    } catch {
      details = {};
    }
    return {
      id: log.id,
      actorName: log.actorName,
      actorRole: log.actorRole,
      createdAt: log.createdAt.toISOString(),
      previous: details.previous,
      updated: details.updated,
      classesAttended: details.classesAttended,
      remainingClasses: details.remainingClasses,
      outstandingBalance: details.outstandingBalance,
    };
  });

  const primaryInvoice = pkg.invoices[0];
  const totalPaid = (pkg.invoices ?? []).reduce((sum, inv) => sum + inv.paidAmount, 0);
  const outstandingBalance = (pkg.invoices ?? []).reduce((sum, inv) => sum + inv.balanceDue, 0);

  return {
    package: balances,
    rawPackage: {
      id: pkg.id,
      packageNumber: pkg.packageNumber,
      name: pkg.name,
      studentId: pkg.studentId,
      studentName: pkg.student.name,
      studentCode: pkg.student.studentCode,
      totalCredits: pkg.totalCredits,
      price: pkg.price,
      startDate: pkg.startDate.toISOString().slice(0, 10),
      expiryDate: pkg.expiryDate ? pkg.expiryDate.toISOString().slice(0, 10) : null,
      status: pkg.status,
      notes: pkg.notes,
    },
    classesAttended,
    remainingClasses: pkg.totalCredits - classesAttended,
    totalPaid,
    outstandingBalance,
    invoices: pkg.invoices,
    allocations: pkg.allocations.map((a) => ({
      subjectId: a.subjectId,
      subjectName: a.subject.name,
      allocatedCredits: a.allocatedCredits,
    })),
    editHistory: parsedHistory,
  };
}

export async function editStudentPackage(packageId: string, input: EditPackageInput, user: CurrentUser) {
  requirePermission(canEditPackages(user.role), "Only Admins and Academic Coordinators can edit packages.");

  if (!input.name || !input.name.trim()) throw validationError("Enter a package name.");
  const newTotalCredits = Number(input.totalCredits);
  if (!Number.isInteger(newTotalCredits) || newTotalCredits < 1) {
    throw validationError("Total classes must be a whole number of 1 or more.");
  }
  const newPrice = Number(input.price);
  if (isNaN(newPrice) || newPrice < 0) {
    throw validationError("Package price must be 0 or more.");
  }
  if (!input.startDate) throw validationError("Choose a package start date.");
  const startDate = new Date(input.startDate);
  if (isNaN(startDate.getTime())) throw validationError("Invalid start date.");
  const expiryDate = input.expiryDate ? new Date(input.expiryDate) : null;
  if (expiryDate && isNaN(expiryDate.getTime())) throw validationError("Invalid expiry date.");

  const validStatuses = ["ACTIVE", "PAUSED", "EXHAUSTED", "EXPIRED", "CLOSED"];
  const status = input.status && validStatuses.includes(input.status) ? input.status : "ACTIVE";

  const { studentId } = await prisma.$transaction(async (tx) => {
    const pkg = await tx.studentPackage.findUnique({
      where: { id: packageId },
      include: {
        student: true,
        allocations: { include: { subject: true } },
        sessions: {
          select: {
            id: true,
            status: true,
            isCreditConsumed: true,
            attendance: { select: { studentAttendance: true, sessionOutcome: true } },
          },
        },
        invoices: {
          where: { status: { not: "CANCELLED" } },
        },
      },
    });

    if (!pkg) throw notFoundError("Package not found.");

    const classesAttended = pkg.sessions.filter(
      (s) => s.isCreditConsumed || s.status === "COMPLETED" || (s.attendance && (s.attendance.studentAttendance === "PRESENT" || s.attendance.sessionOutcome === "COMPLETED"))
    ).length;

    // Warning and confirmation if updated classes are fewer than already attended
    if (newTotalCredits < classesAttended && !input.confirmFewerThanAttended) {
      throw new ApiError(
        400,
        "CONFLICT",
        `Package has ${classesAttended} attended classes, which is more than the requested ${newTotalCredits} total classes. Confirmation is required before saving.`,
        { details: { classesAttended, newTotalCredits, requiresConfirmation: true } }
      );
    }

    const previousDetails = {
      name: pkg.name,
      totalCredits: pkg.totalCredits,
      price: pkg.price,
      startDate: pkg.startDate.toISOString().slice(0, 10),
      expiryDate: pkg.expiryDate ? pkg.expiryDate.toISOString().slice(0, 10) : null,
      status: pkg.status,
      notes: pkg.notes,
    };

    const updatedDetails = {
      name: input.name.trim(),
      totalCredits: newTotalCredits,
      price: newPrice,
      startDate: startDate.toISOString().slice(0, 10),
      expiryDate: expiryDate ? expiryDate.toISOString().slice(0, 10) : null,
      status,
      notes: input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : pkg.notes,
    };

    // 1. Update StudentPackage
    await tx.studentPackage.update({
      where: { id: packageId },
      data: {
        name: updatedDetails.name,
        totalCredits: newTotalCredits,
        price: newPrice,
        startDate,
        expiryDate,
        status,
        notes: updatedDetails.notes,
      },
    });

    // 2. Adjust Subject Allocations
    if (input.allocations && input.allocations.length > 0) {
      const sumAllocated = input.allocations.reduce((sum, a) => sum + (Number(a.allocatedCredits) || 0), 0);
      if (sumAllocated === newTotalCredits) {
        for (const alloc of input.allocations) {
          const existing = pkg.allocations.find((a) => a.subjectId === alloc.subjectId);
          if (existing) {
            await tx.subjectAllocation.update({
              where: { id: existing.id },
              data: { allocatedCredits: Number(alloc.allocatedCredits) || 0 },
            });
          } else {
            await tx.subjectAllocation.create({
              data: {
                packageId,
                subjectId: alloc.subjectId,
                allocatedCredits: Number(alloc.allocatedCredits) || 0,
              },
            });
          }
        }
      }
    } else if (pkg.allocations.length > 0 && pkg.totalCredits !== newTotalCredits) {
      // Rebalance proportionally
      const oldTotal = pkg.totalCredits;
      let allocatedSum = 0;
      for (let i = 0; i < pkg.allocations.length; i++) {
        const alloc = pkg.allocations[i];
        const isLast = i === pkg.allocations.length - 1;
        const newShare = isLast
          ? Math.max(0, newTotalCredits - allocatedSum)
          : Math.max(0, Math.round((alloc.allocatedCredits / oldTotal) * newTotalCredits));
        allocatedSum += newShare;
        await tx.subjectAllocation.update({
          where: { id: alloc.id },
          data: { allocatedCredits: newShare },
        });
      }
    }

    // 3. Update Invoice and Recalculate Outstanding Balance
    const invoice = pkg.invoices[0];
    let totalPaymentsReceived = 0;
    let outstandingBalance = newPrice;
    if (invoice) {
      totalPaymentsReceived = invoice.paidAmount;
      outstandingBalance = Math.max(0, newPrice - totalPaymentsReceived);
      let newInvoiceStatus = invoice.status;
      if (outstandingBalance === 0 && (totalPaymentsReceived > 0 || newPrice === 0)) {
        newInvoiceStatus = "PAID";
      } else if (totalPaymentsReceived > 0 && outstandingBalance > 0) {
        newInvoiceStatus = "PARTIALLY_PAID";
      } else if (totalPaymentsReceived === 0 && newPrice > 0) {
        newInvoiceStatus = "UNPAID";
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: newPrice,
          totalAmount: newPrice,
          balanceDue: outstandingBalance,
          status: newInvoiceStatus,
        },
      });

      const lineItems = await tx.invoiceLineItem.findMany({ where: { invoiceId: invoice.id } });
      if (lineItems.length > 0) {
        await tx.invoiceLineItem.update({
          where: { id: lineItems[0].id },
          data: {
            unitPrice: newPrice,
            amount: newPrice,
            description: updatedDetails.name,
          },
        });
      }
    }

    // 4. Log CreditLedger entry if totalCredits changed
    const creditsDelta = newTotalCredits - pkg.totalCredits;
    const remainingClasses = newTotalCredits - classesAttended;

    await tx.creditLedger.create({
      data: {
        packageId,
        eventType: "PACKAGE_EDIT",
        creditsDelta,
        resultingRemaining: remainingClasses,
        reason: `Package modified by ${user.name}: total classes updated from ${pkg.totalCredits} to ${newTotalCredits}`,
        actorRole: user.role,
        actorName: user.name,
        metadata: JSON.stringify({
          previousCredits: pkg.totalCredits,
          newCredits: newTotalCredits,
          classesAttended,
          remainingClasses,
          previousPrice: pkg.price,
          newPrice,
          outstandingBalance,
        }),
      },
    });

    // 5. Audit Log (Maintains detailed modification history)
    await tx.auditLog.create({
      data: {
        entityType: "PACKAGE",
        entityId: packageId,
        action: "EDIT_PACKAGE",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          packageNumber: pkg.packageNumber,
          studentId: pkg.studentId,
          studentName: pkg.student.name,
          previous: previousDetails,
          updated: updatedDetails,
          classesAttended,
          remainingClasses,
          totalPaymentsReceived,
          outstandingBalance,
        }),
      },
    });

    return { studentId: pkg.studentId };
  });

  if (status === "ACTIVE") {
    try {
      await generateTimetableOccurrences(studentId, user);
    } catch (e) {
      console.error("Auto booking timetable classes after package edit failed:", e);
    }
  }

  const updatedBalances = await calculatePackageBalances(packageId);
  return {
    success: true,
    message: `Package "${input.name}" updated successfully.`,
    package: updatedBalances,
  };
}
