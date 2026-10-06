import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessFinancial, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, relatedRecordError, validationError, withErrorHandling } from "@/lib/api-errors";
import { FieldCollector } from "@/lib/validation";
import { nextCode, withCodeRetry } from "@/lib/codes";
import { readIdempotencyKey, rememberIdempotentEntity, runIdempotent } from "@/lib/idempotency";

export const POST = withErrorHandling("POST /api/invoices", async (req) => {
  const user = await requireUser();
  requirePermission(canAccessFinancial(user.role), "Financial operations require the Accounts or Owner role.");

  const body = await readJsonObject(req);
  const v = new FieldCollector();
  const studentId = v.id("studentId", body.studentId, "Student");
  const dueDate = v.date("dueDate", body.dueDate, "Due date", true);
  const notes = v.optionalText("notes", body.notes, "Notes", 1000);
  const packageId = typeof body.packageId === "string" && body.packageId ? body.packageId : null;

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) v.add("items", "Add at least one line item.");
  if (rawItems.length > 20) v.add("items", "An invoice can have up to 20 line items.");
  const items = rawItems.slice(0, 20).map((raw, i) => {
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const description = v.requiredText(`items.${i}.description`, row.description, "Description", 200);
    const quantity = v.integer(`items.${i}.quantity`, row.quantity, "Quantity", { min: 1, max: 100, fallback: 1 });
    const unitPrice = v.integer(`items.${i}.unitPrice`, row.unitPrice, "Amount (₹)", { min: 1, max: 10_000_000 });
    return { description, quantity, unitPrice, amount: quantity * unitPrice };
  });
  const subtotal = items.reduce((sum, it) => sum + it.amount, 0);
  const discount = v.integer("discount", body.discount, "Discount (₹)", { min: 0, max: Math.max(0, subtotal), fallback: 0 });
  if (v.hasErrors || !dueDate) throw validationError("Please correct the highlighted fields.", v.errors);

  const [student, pkg] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true } }),
    packageId ? prisma.studentPackage.findUnique({ where: { id: packageId }, select: { studentId: true } }) : Promise.resolve(null),
  ]);
  if (!student) throw relatedRecordError("This student no longer exists.", { studentId: "Choose another student." });
  if (packageId && (!pkg || pkg.studentId !== studentId)) {
    throw relatedRecordError("The package does not belong to this student.", { packageId: "Choose one of the student's packages." });
  }

  const totalAmount = subtotal - discount;
  const key = readIdempotencyKey(req);
  const { result: invoice, replayed } = await runIdempotent(
    "CREATE_INVOICE",
    key,
    () =>
      withCodeRetry(["invoice"], () =>
        prisma.$transaction(async (tx) => {
          const created = await tx.invoice.create({
            data: {
              invoiceNumber: await nextCode(tx, "invoice"),
              studentId,
              packageId,
              issueDate: new Date(),
              dueDate,
              subtotal,
              discount,
              totalAmount,
              paidAmount: 0,
              balanceDue: totalAmount,
              currency: "INR",
              status: totalAmount === 0 ? "PAID" : "UNPAID",
              notes,
              items: { create: items },
            },
            include: { items: true },
          });
          await tx.auditLog.create({
            data: {
              entityType: "INVOICE",
              entityId: created.id,
              action: "CREATE_INVOICE",
              actorRole: user.role,
              actorName: user.name,
              details: JSON.stringify({ invoiceNumber: created.invoiceNumber, studentId, subtotal, discount, totalAmount }),
            },
          });
          await rememberIdempotentEntity(tx, "CREATE_INVOICE", key, created.id);
          return created;
        })
      ),
    (id) => prisma.invoice.findUnique({ where: { id }, include: { items: true } })
  );

  return NextResponse.json({ success: true, invoice, replayed }, { status: replayed ? 200 : 201 });
});
