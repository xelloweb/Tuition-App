import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validationError, withErrorHandling } from "@/lib/api-errors";
import { canAccessFinancial, canVerifyPayments, requirePermission } from "@/lib/auth";
import { requireMobileUser } from "@/lib/mobile-auth";

export const GET = withErrorHandling("GET /api/mobile/admin/billing", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canAccessFinancial(user.role));
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const whereClause: any = {};
  if (status && status !== "ALL") {
    whereClause.status = status;
  }

  const invoices = await prisma.invoice.findMany({
    where: whereClause,
    include: {
      student: { select: { id: true, name: true, studentCode: true, guardianName: true, whatsappNumber: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalDue = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

  return NextResponse.json({
    success: true,
    stats: {
      totalInvoiced,
      totalPaid,
      totalDue,
      invoiceCount: invoices.length,
    },
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      studentId: inv.studentId,
      studentName: inv.student.name,
      studentCode: inv.student.studentCode,
      guardianName: inv.student.guardianName,
      whatsappNumber: inv.student.whatsappNumber,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      balanceDue: inv.balanceDue,
      status: inv.status,
      dueDate: inv.dueDate.toISOString(),
      issueDate: inv.issueDate.toISOString(),
      notes: inv.notes,
      items: inv.items.map((i) => ({ description: i.description, amount: i.amount })),
    })),
  });
});

/**
 * "Mark paid" used to set an invoice to Paid with no payment behind it, so the
 * money never reached payments, verification or the reports. Payments are
 * recorded on the website, where they wait for verification like every other.
 */
export const POST = withErrorHandling("POST /api/mobile/admin/billing", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canVerifyPayments(user.role));
  throw validationError(
    "Record payments on the website: Invoices & payments → Record payment. The invoice balance changes once the payment is verified."
  );
});
