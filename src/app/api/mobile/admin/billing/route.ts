import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api-errors";
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

export const POST = withErrorHandling("POST /api/mobile/admin/billing", async (req) => {
  const user = await requireMobileUser(req);
  requirePermission(canVerifyPayments(user.role));
  const body = await req.json();
  const { invoiceId, action } = body;

  if (!invoiceId) {
    return NextResponse.json({ success: false, message: "Invoice ID required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found" }, { status: 404 });
  }

  if (action === "MARK_PAID") {
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
        paidAmount: invoice.totalAmount,
        balanceDue: 0,
      },
    });
    return NextResponse.json({ success: true, invoice: updated, message: "Invoice marked as paid." });
  }

  return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
});
