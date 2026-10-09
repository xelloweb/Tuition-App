import { NextResponse } from "next/server";
import { requireUser, requirePermission, canAccessFinancial } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { removeInvoice, cancelInvoice } from "@/lib/billing";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling<Ctx>("DELETE /api/invoices/[id]", async (_req, { params }) => {
  const user = await requireUser();
  requirePermission(canAccessFinancial(user.role), "Financial operations require the Accounts or Owner role.");

  const { id } = await params;
  const deleted = await removeInvoice(id, user);

  return NextResponse.json({
    success: true,
    message: `Invoice ${deleted.invoiceNumber} removed successfully.`,
    invoiceNumber: deleted.invoiceNumber,
  });
});

export const PATCH = withErrorHandling<Ctx>("PATCH /api/invoices/[id]", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canAccessFinancial(user.role), "Financial operations require the Accounts or Owner role.");

  const { id } = await params;
  const body = await readJsonObject(req);

  if (body.action === "CANCEL" || body.status === "CANCELLED") {
    const updated = await cancelInvoice(id, user, typeof body.reason === "string" ? body.reason : undefined);
    return NextResponse.json({
      success: true,
      message: `Invoice ${updated.invoiceNumber} cancelled successfully.`,
      invoice: updated,
    });
  }

  return NextResponse.json({ success: false, message: "Unsupported action." }, { status: 400 });
});
