import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const {
      studentId,
      amount,
      currency = "INR",
      paymentMethod,
      reference,
      proofFileName,
      proofUrl,
      notes,
    } = body;

    const count = await prisma.payment.count();
    const paymentNumber = `PAY-2026-${(count + 1).toString().padStart(3, "0")}`;

    const payment = await prisma.payment.create({
      data: {
        paymentNumber,
        studentId,
        amount: Number(amount),
        currency,
        paymentMethod,
        reference,
        proofFileName,
        proofUrl: proofUrl || (proofFileName ? `/proofs/${proofFileName}` : null),
        isVerified: false, // Uploading proof DOES NOT automatically verify payment!
        notes,
      },
    });

    return NextResponse.json({ success: true, payment });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to record payment" },
      { status: 400 }
    );
  }
}
