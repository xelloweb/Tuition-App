import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canApprovePayouts, requirePermission, requireUser } from "@/lib/auth";
import { conflictError, readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { FieldCollector } from "@/lib/validation";
import { nextCode, withCodeRetry } from "@/lib/codes";

export const POST = withErrorHandling("POST /api/payouts/run", async (req) => {
  const user = await requireUser();
  requirePermission(canApprovePayouts(user.role), "Only the owner can approve and pay trainer payout runs.");

  const body = await readJsonObject(req);
  const action = body.action;

  if (action === "CREATE_RUN") {
    const v = new FieldCollector();
    const periodStart = v.date("periodStart", body.periodStart, "Period start", false) ?? new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const periodEnd = v.date("periodEnd", body.periodEnd, "Period end", false) ?? new Date();
    if (periodEnd < periodStart) v.add("periodEnd", "Period end must be after the start.");
    if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

    const run = await withCodeRetry(["payoutRun"], () =>
      prisma.$transaction(async (tx) => {
        const pending = await tx.payoutItem.findMany({ where: { payoutRunId: null, status: "APPROVED" } });
        if (pending.length === 0) throw conflictError("There are no approved, unbatched payout items to include.");

        const created = await tx.payoutRun.create({
          data: {
            runNumber: await nextCode(tx, "payoutRun"),
            periodStart,
            periodEnd,
            totalSessions: pending.length,
            totalAmount: pending.reduce((acc, it) => acc + it.amount, 0),
            status: "APPROVED",
            approvedByName: user.name,
            approvedAt: new Date(),
          },
        });
        // Claim only items still unbatched; a concurrent run makes the counts differ and rolls back.
        const claimed = await tx.payoutItem.updateMany({
          where: { id: { in: pending.map((p) => p.id) }, payoutRunId: null, status: "APPROVED" },
          data: { payoutRunId: created.id },
        });
        if (claimed.count !== pending.length) {
          throw conflictError("Another payout run was created at the same time. Refresh and try again.");
        }
        await tx.auditLog.create({
          data: {
            entityType: "PAYOUT_RUN",
            entityId: created.id,
            action: "CREATE_PAYOUT_RUN",
            actorRole: user.role,
            actorName: user.name,
            details: JSON.stringify({ runNumber: created.runNumber, items: pending.length, totalAmount: created.totalAmount }),
          },
        });
        return created;
      })
    );
    return NextResponse.json({ success: true, run }, { status: 201 });
  }

  if (action === "MARK_PAID") {
    const runId = typeof body.runId === "string" ? body.runId : "";
    if (!runId) throw validationError("Choose the payout run to mark as paid.");
    const run = await prisma.$transaction(async (tx) => {
      // Only an approved, unpaid run can be paid — never twice.
      const paid = await tx.payoutRun.updateMany({
        where: { id: runId, status: "APPROVED" },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (paid.count !== 1) throw conflictError("This payout run is already paid or no longer exists.");
      const items = await tx.payoutItem.updateMany({
        where: { payoutRunId: runId, status: "APPROVED" },
        data: { status: "PAID" },
      });
      await tx.auditLog.create({
        data: {
          entityType: "PAYOUT_RUN",
          entityId: runId,
          action: "MARK_PAYOUT_RUN_PAID",
          actorRole: user.role,
          actorName: user.name,
          details: JSON.stringify({ itemsPaid: items.count }),
        },
      });
      return tx.payoutRun.findUniqueOrThrow({ where: { id: runId } });
    });
    return NextResponse.json({ success: true, run });
  }

  throw validationError("Unknown payout action.");
});
