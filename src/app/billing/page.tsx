import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessFinancial } from "@/lib/auth";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  const user = await getCurrentUser();

  const invoices = await prisma.invoice.findMany({
    include: {
      student: true,
      items: true,
    },
    orderBy: { issueDate: "desc" },
  });

  const payments = await prisma.payment.findMany({
    include: {
      student: {
        include: { invoices: true },
      },
      allocations: true,
    },
    orderBy: { receivedDate: "desc" },
  });

  const unverifiedPayments = payments.filter((p) => !p.isVerified);

  const students = await prisma.student.findMany({
    orderBy: { name: "asc" },
  });

  const now = new Date();
  let netBilled = 0;
  let verifiedCollections = 0;
  let outstanding = 0;
  let overdue = 0;
  let totalAllocated = 0;

  for (const inv of invoices) {
    if (inv.status !== "CANCELLED") {
      netBilled += inv.totalAmount;
      outstanding += inv.balanceDue;
      if (inv.balanceDue > 0 && new Date(inv.dueDate) < now) {
        overdue += inv.balanceDue;
      }
    }
  }

  for (const pay of payments) {
    if (pay.isVerified) {
      verifiedCollections += pay.amount;
      for (const a of pay.allocations) {
        totalAllocated += a.amount;
      }
    }
  }

  const unallocatedAdvances = Math.max(0, verifiedCollections - totalAllocated);

  return (
    <BillingClient
      invoices={invoices}
      payments={payments}
      unverifiedPayments={unverifiedPayments}
      students={students}
      financialStats={{
        netBilled,
        verifiedCollections,
        outstanding,
        overdue,
        unallocatedAdvances,
      }}
    />
  );
}
