import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canApprovePayouts } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!canApprovePayouts(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only Admin / Owner can approve teacher payout runs." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, runId, periodStart, periodEnd } = body;

    if (action === "CREATE_RUN") {
      const count = await prisma.payoutRun.count();
      const runNumber = `PAYOUT-2026-${(count + 1).toString().padStart(2, "0")}`;

      // Find pending payout items
      const pendingItems = await prisma.payoutItem.findMany({
        where: {
          payoutRunId: null,
          status: "APPROVED",
        },
      });

      const totalAmount = pendingItems.reduce((acc, it) => acc + it.amount, 0);

      const run = await prisma.payoutRun.create({
        data: {
          runNumber,
          periodStart: new Date(periodStart || Date.now() - 30 * 24 * 3600 * 1000),
          periodEnd: new Date(periodEnd || Date.now()),
          totalSessions: pendingItems.length,
          totalAmount,
          status: "APPROVED",
          approvedByName: user.name,
          approvedAt: new Date(),
          items: {
            connect: pendingItems.map((it) => ({ id: it.id })),
          },
        },
      });

      return NextResponse.json({ success: true, run });
    }

    if (action === "MARK_PAID" && runId) {
      const updatedRun = await prisma.$transaction(async (tx) => {
        const run = await tx.payoutRun.update({
          where: { id: runId },
          data: {
            status: "PAID",
            paidAt: new Date(),
          },
        });

        await tx.payoutItem.updateMany({
          where: { payoutRunId: runId },
          data: { status: "PAID" },
        });

        return run;
      });

      return NextResponse.json({ success: true, run: updatedRun });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process payout run" },
      { status: 400 }
    );
  }
}
