import { prisma } from "./prisma";
import { CurrentUser, PaymentMethod } from "./types";
import { canVerifyPayments } from "./auth";
import { conflictError, forbiddenError, notFoundError, relatedRecordError } from "./api-errors";
import { BUSINESS_TIME_ZONE } from "./constants";
import { localDateInZone } from "./zoned-time";

export const PAYMENT_METHODS: PaymentMethod[] = ["UPI", "BANK_TRANSFER", "CASH", "CARD", "STRIPE", "RAZORPAY"];

/**
 * A balance is overdue only once its due date has fully passed in the business
 * time zone (IST): an invoice due today is "due today", not overdue.
 */
export function isPastDue(dueDate: Date | string, now: Date = new Date()): boolean {
  return localDateInZone(now, BUSINESS_TIME_ZONE) > localDateInZone(new Date(dueDate), BUSINESS_TIME_ZONE);
}

/** Whole days since the due date (0 = due today, negative = not yet due), counted in IST. */
export function daysPastDue(dueDate: Date | string, now: Date = new Date()): number {
  const today = Date.parse(`${localDateInZone(now, BUSINESS_TIME_ZONE)}T00:00:00Z`);
  const due = Date.parse(`${localDateInZone(new Date(dueDate), BUSINESS_TIME_ZONE)}T00:00:00Z`);
  return Math.round((today - due) / 86400000);
}

export interface VerifyPaymentParams {
  paymentId: string;
  invoiceId?: string;
  user: CurrentUser;
  notes?: string;
}

/**
 * Marks a payment verified and optionally applies it to one of the same
 * student's invoices. Verification is claimed atomically, so a double click or
 * two staff members verifying at once cannot count the money twice.
 */
export async function verifyAndAllocatePayment(params: VerifyPaymentParams) {
  const { paymentId, invoiceId, user, notes } = params;

  if (!canVerifyPayments(user.role)) {
    throw forbiddenError("Unauthorized: Only Accounts staff or Admins can verify payments.");
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFoundError("Payment record not found.");
  if (payment.isVerified) throw conflictError("Payment has already been verified.");

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, isVerified: false },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedByName: user.name,
        verifiedByRole: user.role,
        notes: notes ? `${payment.notes ? payment.notes + " | " : ""}${notes}` : payment.notes,
      },
    });
    if (claimed.count !== 1) throw conflictError("Payment has already been verified.");

    let allocated = 0;
    if (invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw relatedRecordError("Target invoice not found.");
      if (invoice.studentId !== payment.studentId) {
        throw relatedRecordError("This invoice belongs to a different student. Choose one of this student's invoices.");
      }
      if (invoice.status === "CANCELLED") throw conflictError("This invoice is cancelled and cannot receive payments.");

      allocated = Math.min(payment.amount, invoice.balanceDue);
      if (allocated > 0) {
        // Conditional decrement: fails instead of overpaying if the balance changed meanwhile.
        const applied = await tx.invoice.updateMany({
          where: { id: invoiceId, balanceDue: { gte: allocated } },
          data: { paidAmount: { increment: allocated }, balanceDue: { decrement: allocated } },
        });
        if (applied.count !== 1) throw conflictError("The invoice balance changed while verifying. Refresh and try again.");
        await tx.paymentAllocation.create({ data: { paymentId, invoiceId, amount: allocated } });

        const updated = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
        const status = updated.balanceDue === 0 ? "PAID" : updated.paidAmount > 0 ? "PARTIALLY_PAID" : updated.status;
        if (status !== updated.status) await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
      }
    }

    await tx.auditLog.create({
      data: {
        entityType: "PAYMENT",
        entityId: paymentId,
        action: "VERIFY_PAYMENT",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({
          amount: payment.amount,
          invoiceId: invoiceId ?? null,
          allocated,
          unallocatedAdvance: payment.amount - allocated,
        }),
      },
    });

    return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
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

      // Overdue only after the due date has passed (IST), never on the due date itself.
      if (inv.balanceDue > 0 && isPastDue(inv.dueDate, now)) {
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
