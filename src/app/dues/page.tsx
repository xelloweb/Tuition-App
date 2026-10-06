import { prisma } from "@/lib/prisma";
import { DuesClient } from "./DuesClient";

export default async function DuesPage() {
  const now = new Date();

  // Invoices with positive balanceDue
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      balanceDue: { gt: 0 },
      status: { not: "CANCELLED" },
    },
    include: {
      student: { include: { guardian: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  // Categorize into age bands
  const dueToday: any[] = [];
  const band1to7: any[] = [];
  const band8to15: any[] = [];
  const band16to30: any[] = [];
  const band30plus: any[] = [];

  for (const inv of unpaidInvoices) {
    const diffTime = now.getTime() - new Date(inv.dueDate).getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      dueToday.push(inv);
    } else if (diffDays >= 1 && diffDays <= 7) {
      band1to7.push(inv);
    } else if (diffDays >= 8 && diffDays <= 15) {
      band8to15.push(inv);
    } else if (diffDays >= 16 && diffDays <= 30) {
      band16to30.push(inv);
    } else if (diffDays > 30) {
      band30plus.push(inv);
    }
  }

  // Active packages nearing exhaustion (<3 credits remaining)
  const activePackages = await prisma.studentPackage.findMany({
    where: { status: "ACTIVE" },
    include: {
      student: { include: { guardian: true } },
      sessions: { where: { isCreditConsumed: true } },
    },
  });

  const exhaustingPackages = activePackages.filter((pkg) => {
    const consumed = pkg.sessions.length;
    const remaining = pkg.totalCredits - consumed;
    return remaining > 0 && remaining <= 3;
  });

  // Packages nearing expiry (in next 14 days)
  const fourteenDaysFuture = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  const expiringPackages = activePackages.filter((pkg) => {
    return (
      pkg.expiryDate &&
      new Date(pkg.expiryDate) > now &&
      new Date(pkg.expiryDate) <= fourteenDaysFuture
    );
  });

  // Unverified payments
  const unverifiedPayments = await prisma.payment.findMany({
    where: { isVerified: false },
    include: { student: true },
  });

  // Follow-ups with promised payment date
  const promisedFollowUps = await prisma.followUp.findMany({
    where: {
      promisedPaymentDate: { not: null },
      isResolved: false,
    },
    include: { student: true },
    orderBy: { promisedPaymentDate: "asc" },
  });

  return (
    <DuesClient
      overdueBands={{
        dueToday,
        band1to7,
        band8to15,
        band16to30,
        band30plus,
      }}
      exhaustingPackages={exhaustingPackages}
      expiringPackages={expiringPackages}
      unverifiedPayments={unverifiedPayments}
      promisedFollowUps={promisedFollowUps}
    />
  );
}
