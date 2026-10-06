import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canVerifyPayments, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, relatedRecordError, validationError, withErrorHandling } from "@/lib/api-errors";
import { FieldCollector } from "@/lib/validation";
import { PAYMENT_METHODS } from "@/lib/billing";
import { nextCode, withCodeRetry } from "@/lib/codes";
import { readIdempotencyKey, rememberIdempotentEntity, runIdempotent } from "@/lib/idempotency";

/**
 * Records a received payment (with optional proof metadata). Recording never
 * reduces an invoice balance: only verification applies the money.
 */
export const POST = withErrorHandling("POST /api/payments", async (req) => {
  const user = await requireUser();
  requirePermission(canVerifyPayments(user.role), "Only Accounts staff or the owner can record payments.");

  const body = await readJsonObject(req);
  const v = new FieldCollector();
  const studentId = v.id("studentId", body.studentId, "Student");
  const amount = v.integer("amount", body.amount, "Amount (₹)", { min: 1, max: 10_000_000 });
  const paymentMethod = v.oneOf("paymentMethod", body.paymentMethod, PAYMENT_METHODS, "Payment method");
  const receivedDate = v.date("receivedDate", body.receivedDate, "Received date", false) ?? new Date();
  if (receivedDate.getTime() > Date.now() + 24 * 3600 * 1000) v.add("receivedDate", "Received date cannot be in the future.");
  const reference = v.optionalText("reference", body.reference, "Reference", 100);
  const proofFileName = v.optionalText("proofFileName", body.proofFileName, "Proof file name", 200);
  const notes = v.optionalText("notes", body.notes, "Notes", 1000);
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) throw relatedRecordError("This student no longer exists.", { studentId: "Choose another student." });

  const key = readIdempotencyKey(req);
  const { result: payment, replayed } = await runIdempotent(
    "RECORD_PAYMENT",
    key,
    () =>
      withCodeRetry(["payment"], () =>
        prisma.$transaction(async (tx) => {
          const created = await tx.payment.create({
            data: {
              paymentNumber: await nextCode(tx, "payment"),
              studentId,
              amount,
              currency: "INR",
              receivedDate,
              paymentMethod,
              reference,
              proofFileName,
              proofUrl: null,
              isVerified: false,
              notes,
            },
          });
          await tx.auditLog.create({
            data: {
              entityType: "PAYMENT",
              entityId: created.id,
              action: "RECORD_PAYMENT",
              actorRole: user.role,
              actorName: user.name,
              details: JSON.stringify({ paymentNumber: created.paymentNumber, amount, paymentMethod, studentId }),
            },
          });
          await rememberIdempotentEntity(tx, "RECORD_PAYMENT", key, created.id);
          return created;
        })
      ),
    (id) => prisma.payment.findUnique({ where: { id } })
  );

  return NextResponse.json({ success: true, payment, replayed }, { status: replayed ? 200 : 201 });
});
