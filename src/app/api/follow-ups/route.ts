import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const {
      studentId,
      invoiceId,
      packageId,
      type,
      outcome,
      parentResponse,
      promisedPaymentDate,
      nextActionDate,
      notes,
    } = body;

    const followUp = await prisma.followUp.create({
      data: {
        studentId,
        invoiceId: invoiceId || null,
        packageId: packageId || null,
        type: type || "DUE_PAYMENT",
        assignedStaff: user.name,
        contactDate: new Date(),
        outcome,
        parentResponse,
        promisedPaymentDate: promisedPaymentDate ? new Date(promisedPaymentDate) : null,
        nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
        notes,
      },
    });

    return NextResponse.json({ success: true, followUp });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to log follow-up" },
      { status: 400 }
    );
  }
}
