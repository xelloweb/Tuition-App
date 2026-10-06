import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyAndAllocatePayment } from "@/lib/billing";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await req.json().catch(() => ({}));
    const { invoiceId, notes } = body;

    const result = await verifyAndAllocatePayment({
      paymentId: id,
      invoiceId,
      user,
      notes,
    });

    return NextResponse.json({ success: true, payment: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to verify payment" },
      { status: 400 }
    );
  }
}
