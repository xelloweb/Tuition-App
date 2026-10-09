/**
 * One-time removal of the owner's test admission, requested by the owner on
 * 9 Oct 2026: student XEL-2026-001 "shamrood a" with invoice INV-2026-001
 * (₹3,000) and everything attached to it (payment, package, classes,
 * attendance, timetable, parent record if unused).
 *
 * Deletes nothing unless every check matches, and stops if the student has
 * more records than a test would. Ran once, in the deploy of 9 Oct 2026
 * 23:46 IST, and is no longer part of the build. Kept as a record.
 */
import { PrismaClient } from "@prisma/client";

export interface TestStudentTarget {
  studentCode: string;
  name: string;
  invoiceNumber: string;
  invoiceTotal: number;
}

export const TARGET: TestStudentTarget = {
  studentCode: "XEL-2026-001",
  name: "shamrood a",
  invoiceNumber: "INV-2026-001",
  invoiceTotal: 3000,
};

/** A test entry stays small; anything bigger is treated as a real student and left alone. */
export const LIMITS = { invoices: 3, payments: 3, paymentsTotal: 3000, sessions: 300 };

export async function removeTestStudent(db: PrismaClient, target: TestStudentTarget, limits = LIMITS) {
  const student = await db.student.findUnique({
    where: { studentCode: target.studentCode },
    include: { invoices: true, payments: true, sessions: { select: { id: true } } },
  });
  if (!student) return { removed: false, reason: `No student ${target.studentCode}; nothing to remove.` };

  const stop = (reason: string) => ({ removed: false, reason: `Not removed: ${reason}` });
  if (student.name.trim().toLowerCase() !== target.name.trim().toLowerCase()) {
    return stop(`${target.studentCode} is not named "${target.name}".`);
  }
  if (!student.invoices.some((i) => i.invoiceNumber === target.invoiceNumber && i.totalAmount === target.invoiceTotal)) {
    return stop(`${target.studentCode} has no invoice ${target.invoiceNumber} for ₹${target.invoiceTotal}.`);
  }
  const paidTotal = student.payments.reduce((sum, p) => sum + p.amount, 0);
  if (student.invoices.length > limits.invoices || student.payments.length > limits.payments || paidTotal > limits.paymentsTotal || student.sessions.length > limits.sessions) {
    return stop(`${target.studentCode} has more records than a test entry (${student.invoices.length} invoices, ${student.payments.length} payments, ₹${paidTotal}, ${student.sessions.length} classes).`);
  }
  const lockedPay = await db.payoutItem.count({
    where: { session: { studentId: student.id }, OR: [{ status: "PAID" }, { payoutRunId: { not: null } }] },
  });
  if (lockedPay > 0) return stop(`a trainer payout for ${target.studentCode}'s classes is already paid or in a payout run.`);

  const counts = await db.$transaction(async (tx) => {
    // Records that block deleting the student go first; the rest is removed with it.
    const followUps = await tx.followUp.deleteMany({ where: { studentId: student.id } });
    const slots = await tx.timetableSlot.deleteMany({ where: { enrolment: { studentId: student.id } } });
    const invoices = await tx.invoice.deleteMany({ where: { studentId: student.id } });
    const payments = await tx.payment.deleteMany({ where: { studentId: student.id } });
    const sessions = await tx.session.count({ where: { studentId: student.id } });
    const packages = await tx.studentPackage.count({ where: { studentId: student.id } });
    await tx.student.delete({ where: { id: student.id } });

    let guardianRemoved = false;
    if (student.guardianId && (await tx.student.count({ where: { guardianId: student.guardianId } })) === 0) {
      await tx.guardian.delete({ where: { id: student.guardianId } });
      guardianRemoved = true;
    }

    const summary = {
      studentCode: student.studentCode,
      invoices: invoices.count,
      payments: payments.count,
      paymentsTotal: paidTotal,
      packages,
      classes: sessions,
      weeklySlots: slots.count,
      followUps: followUps.count,
      guardianRemoved,
    };
    await tx.auditLog.create({
      data: {
        entityType: "STUDENT",
        entityId: student.id,
        action: "REMOVE_TEST_STUDENT",
        actorRole: "SYSTEM",
        actorName: "Owner request (test entry), 9 Oct 2026",
        details: JSON.stringify(summary),
      },
    });
    return summary;
  });
  return { removed: true, reason: `Removed test student ${student.studentCode}.`, counts };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  removeTestStudent(prisma, TARGET)
    .then((result) => console.log(`▶ Test student clean-up: ${result.reason}`, "counts" in result ? JSON.stringify(result.counts) : ""))
    // Never block a deploy: on any error the transaction has rolled back and nothing changed.
    .catch((e) => console.error("Test student clean-up failed; nothing was changed:", e instanceof Error ? e.message : e))
    .finally(() => prisma.$disconnect());
}
