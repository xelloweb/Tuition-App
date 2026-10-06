import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const ledgers = await prisma.creditLedger.findMany({
      where: { packageId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ledgers });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load ledger" },
      { status: 500 }
    );
  }
}
