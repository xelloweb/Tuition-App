import { NextResponse } from "next/server";
import { canVerifyPayments, requirePermission, requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-errors";
import { verifyAndAllocatePayment } from "@/lib/billing";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>("POST /api/payments/[id]/verify", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canVerifyPayments(user.role), "Only Accounts staff or the owner can verify payments.");

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const invoiceId = typeof body.invoiceId === "string" && body.invoiceId ? body.invoiceId : undefined;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : undefined;

  const result = await verifyAndAllocatePayment({ paymentId: id, invoiceId, user, notes });
  return NextResponse.json({ success: true, payment: result });
});
