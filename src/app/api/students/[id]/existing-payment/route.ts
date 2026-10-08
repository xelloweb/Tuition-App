import { NextResponse } from "next/server";
import { canAssignExistingPayments, requirePermission, requireUser } from "@/lib/auth";
import { notFoundError, readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { assignPackageFromExistingPayment, existingPaymentOptions } from "@/lib/services/existing-payment-packages";

type Ctx = { params: Promise<{ id: string }> };
const DENIED = "Only the owner, coordinators or accounts can assign a package using an existing payment.";

/** Paid money that is not yet a working package (paid package without subjects, unlinked paid invoice, unused payment). */
export const GET = withErrorHandling<Ctx>("GET /api/students/[id]/existing-payment", async (_req, { params }) => {
  const user = await requireUser();
  requirePermission(canAssignExistingPayments(user.role), DENIED);
  const options = await existingPaymentOptions((await params).id);
  if (!options) throw notFoundError("This student no longer exists.");
  return NextResponse.json({ success: true, options });
});

/** Assigns a package using money already paid. Never creates a payment. */
export const POST = withErrorHandling<Ctx>("POST /api/students/[id]/existing-payment", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canAssignExistingPayments(user.role), DENIED);
  const result = await assignPackageFromExistingPayment((await params).id, await readJsonObject(req), user);
  return NextResponse.json({ success: true, result }, { status: 201 });
});
