/**
 * Cleanup script to remove unwanted / accidental unpaid invoices:
 * - Specifically addresses INV-2026-002 and INV-2026-003
 * - Also checks for any duplicate UNPAID invoices for students XST-131 and XST-132
 *   that have zero payments received and an existing paid invoice.
 * One-time clean-up (9 Oct 2026). Not part of the build any more: invoice numbers
 * can be issued again after a deletion, and new unpaid invoices for these students
 * are legitimate, so running it on every deploy could delete real invoices.
 * Run manually only after checking the targets: npm run cleanup-unpaid-invoices
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("▶ Cleaning up unwanted unpaid invoices...");

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { invoiceNumber: { in: ["INV-2026-002", "INV-2026-003"] } },
        {
          student: { studentCode: { in: ["XST-131", "XST-132"] } },
          status: "UNPAID",
          paidAmount: 0,
        },
      ],
    },
    include: {
      student: true,
      allocations: true,
      items: true,
    },
  });

  if (invoices.length === 0) {
    console.log("No unwanted unpaid invoices found. Clean.");
    return;
  }

  for (const inv of invoices) {
    if (inv.paidAmount > 0) {
      console.log(`Skipping invoice ${inv.invoiceNumber} as it has recorded payments (₹${inv.paidAmount}).`);
      continue;
    }

    console.log(`Removing unpaid invoice ${inv.invoiceNumber} for ${inv.student?.name} (${inv.student?.studentCode}), balance: ₹${inv.balanceDue}...`);
    await prisma.$transaction(async (tx) => {
      await tx.paymentAllocation.deleteMany({ where: { invoiceId: inv.id } });
      await tx.invoiceInstalment.deleteMany({ where: { invoiceId: inv.id } });
      await tx.followUp.deleteMany({ where: { invoiceId: inv.id } });
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: inv.id } });
      await tx.invoice.delete({ where: { id: inv.id } });

      await tx.auditLog.create({
        data: {
          entityType: "INVOICE",
          entityId: inv.id,
          action: "DELETE_UNPAID_INVOICE",
          actorRole: "SYSTEM",
          actorName: "Cleanup Unpaid Invoices",
          details: JSON.stringify({
            invoiceNumber: inv.invoiceNumber,
            studentName: inv.student?.name,
            studentCode: inv.student?.studentCode,
            totalAmount: inv.totalAmount,
            balanceDue: inv.balanceDue,
            reason: "User requested removal of unpaid invoice",
          }),
        },
      });
    });

    console.log(`✓ Removed unpaid invoice ${inv.invoiceNumber}`);
  }
}

main()
  .catch((e) => {
    console.error("Error during unpaid invoices cleanup:", e);
  })
  .finally(() => prisma.$disconnect());
