import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFinancial } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!canAccessFinancial(user.role)) {
      return NextResponse.json({ error: "Forbidden: Financial operations require Accounts or Admin role." }, { status: 403 });
    }

    const body = await req.json();
    const {
      studentId,
      packageId,
      dueDate,
      items,
      discount = 0,
      currency = "INR",
      notes,
    } = body;

    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-2026-${(count + 1).toString().padStart(3, "0")}`;

    let subtotal = 0;
    const formattedItems = (items || []).map((it: any) => {
      const lineTotal = Number(it.unitPrice) * (Number(it.quantity) || 1);
      subtotal += lineTotal;
      return {
        description: it.description,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice),
        amount: lineTotal,
      };
    });

    const totalAmount = Math.max(0, subtotal - Number(discount));

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        studentId,
        packageId: packageId || null,
        issueDate: new Date(),
        dueDate: new Date(dueDate),
        subtotal,
        discount: Number(discount),
        totalAmount,
        paidAmount: 0,
        balanceDue: totalAmount,
        currency,
        status: "UNPAID",
        notes,
        items: {
          create: formattedItems,
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create invoice" },
      { status: 400 }
    );
  }
}
