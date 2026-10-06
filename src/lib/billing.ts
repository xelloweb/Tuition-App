import { prisma } from "./prisma";
import { CurrentUser, PaymentMethod } from "./types";
import { canVerifyPayments } from "./auth";

export interface VerifyPaymentParams {
  paymentId: string;
  invoiceId?: string;
  user: CurrentUser;
  notes?: string;
}

export async function verifyAndAllocatePayment(params: VerifyPaymentParams) {
  const { paymentId, invoiceId, user, notes } = params;

  if (!canVerifyPayments(user.role)) {
    throw new Error("Unauthorized: Only Accounts staff or Admins can verify payments.");
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      allocations: true,
      student: true,
    },
  });

  if (!payment) {
    throw new Error("Payment record not found.");
  }

  if (payment.isVerified) {
    throw new Error("Payment has already been verified.");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Mark payment as verified
    const verifiedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedByName: user.name,
        verifiedByRole: user.role,
        notes: notes ? `${payment.notes ? payment.notes + " | " : ""}${notes}` : payment.notes,
      },
    });

    // 2. If invoiceId provided, allocate payment to invoice
    if (invoiceId) {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) throw new Error("Target invoice not found.");

      const allocationAmount = Math.min(payment.amount, invoice.balanceDue);

      if (allocationAmount > 0) {
        await tx.paymentAllocation.create({
          data: {
            paymentId,
            invoiceId,
            amount: allocationAmount,
          },
        });

        const newPaidAmount = invoice.paidAmount + allocationAmount;
        const newBalanceDue = Math.max(0, invoice.totalAmount - newPaidAmount);
        const newStatus =
          newBalanceDue === 0
            ? "PAID"
            : newPaidAmount > 0
            ? "PARTIALLY_PAID"
            : invoice.status;

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceDue: newBalanceDue,
            status: newStatus,
          },
        });
      }
    }

    // 3. Audit log
    await tx.auditLog.create({
      data: {
        entityType: "PAYMENT",
        entityId: paymentId,
        action: "VERIFY_PAYMENT",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          amount: payment.amount,
          invoiceId,
        }),
      },
    });

    return verifiedPayment;
  });
}

export async function calculateStudentFinancialSummary(studentId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { studentId },
    include: { instalments: true },
  });

  const payments = await prisma.payment.findMany({
    where: { studentId },
    include: { allocations: true },
  });

  const now = new Date();

  let netBilled = 0;
  let verifiedPayments = 0;
  let unverifiedPayments = 0;
  let outstanding = 0;
  let overdue = 0;

  for (const inv of invoices) {
    if (inv.status !== "CANCELLED") {
      netBilled += inv.totalAmount;
      outstanding += inv.balanceDue;

      // Only overdue if balanceDue > 0 AND dueDate < now
      if (inv.balanceDue > 0 && new Date(inv.dueDate) < now) {
        overdue += inv.balanceDue;
      }
    }
  }

  let totalAllocated = 0;
  for (const pay of payments) {
    if (pay.isVerified) {
      verifiedPayments += pay.amount;
      for (const alloc of pay.allocations) {
        totalAllocated += alloc.amount;
      }
    } else {
      unverifiedPayments += pay.amount;
    }
  }

  // Unallocated advance = verified payments that haven't been applied to an invoice
  const unallocatedAdvances = Math.max(0, verifiedPayments - totalAllocated);

  return {
    studentId,
    netBilled,
    verifiedPayments,
    unverifiedPayments,
    unallocatedAdvances,
    outstanding,
    overdue,
    invoicesCount: invoices.length,
    paymentsCount: payments.length,
  };
}
