/**
 * "Assign package using existing payment": students admitted or imported before
 * packages were set up can have money already paid but no working package:
 *  - PACKAGE: a paid package with no classes allocated to subjects (the bulk import);
 *  - INVOICE: a paid invoice that is not linked to any package;
 *  - PAYMENTS: a verified payment not applied to any invoice (an advance).
 * Assigning links that money to a package. It never creates a payment, so the
 * student's total paid, payment reports and dashboard receipts do not change.
 * (Buying a further package is the separate "Purchase new package" action,
 * which creates a new invoice to collect.)
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { conflictError, notFoundError, validationError } from "../api-errors";
import { FieldCollector } from "../validation";
import { nextCode, withCodeRetry } from "../codes";
import { addPackageAllocations, createPackageForStudent } from "./students";

type Db = PrismaClient | Prisma.TransactionClient;
type Tx = Prisma.TransactionClient;

const LEDGER_REASON = "Package set up from an existing payment (no new payment created)";
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** What paid money a student has that is not yet working as a package. */
export async function existingPaymentOptions(studentId: string, db: Db = prisma) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      studentCode: true,
      enrolments: { where: { status: "ACTIVE" }, select: { subjectId: true, subject: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!student) return null;

  const [packages, invoices, payments] = await Promise.all([
    db.studentPackage.findMany({
      where: { studentId, status: "ACTIVE", allocations: { none: {} } },
      include: { invoices: { where: { status: { not: "CANCELLED" } }, select: { invoiceNumber: true, totalAmount: true, paidAmount: true, balanceDue: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.invoice.findMany({
      where: { studentId, packageId: null, status: { not: "CANCELLED" }, paidAmount: { gt: 0 } },
      orderBy: { issueDate: "asc" },
    }),
    db.payment.findMany({ where: { studentId }, include: { allocations: { select: { amount: true } } }, orderBy: { receivedDate: "asc" } }),
  ]);

  const unsetPackages = packages
    .map((p) => ({
      id: p.id,
      packageNumber: p.packageNumber,
      name: p.name,
      totalCredits: p.totalCredits,
      price: p.price,
      startDate: p.startDate.toISOString(),
      expiryDate: iso(p.expiryDate),
      paid: p.invoices.reduce((sum, i) => sum + i.paidAmount, 0),
      balanceDue: p.invoices.reduce((sum, i) => sum + i.balanceDue, 0),
      invoiceNumbers: p.invoices.map((i) => i.invoiceNumber),
    }))
    .filter((p) => p.paid > 0);

  const unlinkedInvoices = invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    totalAmount: i.totalAmount,
    paidAmount: i.paidAmount,
    balanceDue: i.balanceDue,
    issueDate: i.issueDate.toISOString(),
  }));

  const unusedPayments = payments
    .filter((p) => p.isVerified)
    .map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      amount: p.amount,
      unused: p.amount - p.allocations.reduce((sum, a) => sum + a.amount, 0),
      receivedDate: p.receivedDate.toISOString(),
    }))
    .filter((p) => p.unused > 0);

  return {
    student: { id: student.id, name: student.name, studentCode: student.studentCode },
    subjects: student.enrolments.map((e) => ({ subjectId: e.subjectId, name: e.subject.name })),
    unsetPackages,
    unlinkedInvoices,
    unusedPayments,
    unusedTotal: unusedPayments.reduce((sum, p) => sum + p.unused, 0),
    unverifiedTotal: payments.filter((p) => !p.isVerified).reduce((sum, p) => sum + p.amount, 0),
  };
}
export type ExistingPaymentOptions = NonNullable<Awaited<ReturnType<typeof existingPaymentOptions>>>;

export const hasExistingPaymentToUse = (o: ExistingPaymentOptions | null) =>
  Boolean(o && (o.unsetPackages.length || o.unlinkedInvoices.length || o.unusedTotal > 0));

/** Students with paid money that is not yet a working package (for the owner's to-do list). */
export async function studentsNeedingPackageSetup() {
  const [packages, invoices, payments] = await Promise.all([
    prisma.studentPackage.findMany({
      where: { status: "ACTIVE", allocations: { none: {} }, invoices: { some: { paidAmount: { gt: 0 }, status: { not: "CANCELLED" } } } },
      select: { studentId: true },
    }),
    prisma.invoice.findMany({ where: { packageId: null, paidAmount: { gt: 0 }, status: { not: "CANCELLED" } }, select: { studentId: true } }),
    prisma.payment.findMany({ where: { isVerified: true }, select: { studentId: true, amount: true, allocations: { select: { amount: true } } } }),
  ]);
  const reasons = new Map<string, Set<string>>();
  const add = (id: string, reason: string) => reasons.set(id, (reasons.get(id) ?? new Set()).add(reason));
  for (const p of packages) add(p.studentId, "Paid package without subjects");
  for (const i of invoices) add(i.studentId, "Paid invoice without a package");
  for (const p of payments) if (p.amount - p.allocations.reduce((s, a) => s + a.amount, 0) > 0) add(p.studentId, "Unused payment");
  if (reasons.size === 0) return [];
  const students = await prisma.student.findMany({
    where: { id: { in: [...reasons.keys()] } },
    select: { id: true, name: true, studentCode: true },
    orderBy: { name: "asc" },
  });
  return students.map((s) => ({ ...s, reasons: [...(reasons.get(s.id) ?? [])] }));
}

export interface AssignResult {
  packageId: string;
  packageNumber: string;
  invoiceNumber: string | null;
  packageValue: number;
  paidFromExisting: number;
  stillToPay: number;
  newPaymentCreated: 0;
}

/**
 * Body: { source: { type: "PACKAGE" | "INVOICE", id } | { type: "PAYMENTS" },
 *         name?, totalCredits, price (PAYMENTS only), startDate, expiryDate?,
 *         allocations: [{ subjectId, allocatedCredits }] }
 */
export async function assignPackageFromExistingPayment(studentId: string, body: Record<string, unknown>, user: CurrentUser): Promise<AssignResult> {
  const v = new FieldCollector();
  const rawSource = (body.source && typeof body.source === "object" ? body.source : {}) as Record<string, unknown>;
  const type = rawSource.type;
  const sourceId = typeof rawSource.id === "string" ? rawSource.id : "";
  if (type !== "PACKAGE" && type !== "INVOICE" && type !== "PAYMENTS") v.add("source", "Choose which existing payment to use.");
  if ((type === "PACKAGE" || type === "INVOICE") && !sourceId) v.add("source", "Choose which existing payment to use.");

  const name = v.optionalText("name", body.name, "Package name", 120);
  const totalCredits = v.integer("totalCredits", body.totalCredits, "Total classes", { min: 1, max: 500 });
  const price = type === "PAYMENTS" ? v.integer("price", body.price, "Package value (₹)", { min: 1, max: 10_000_000 }) : 0;
  const startDate = v.date("startDate", body.startDate, "Start date", true);
  const expiryDate = v.date("expiryDate", body.expiryDate, "Valid until", false);
  if (startDate && expiryDate && expiryDate <= startDate) v.add("expiryDate", "The validity must end after the start date.");

  const allocations: { subjectId: string; allocatedCredits: number }[] = [];
  const rawAllocations = Array.isArray(body.allocations) ? body.allocations : [];
  const seen = new Set<string>();
  rawAllocations.forEach((item, i) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const subjectId = v.id(`allocations.${i}.subjectId`, row.subjectId, "Subject");
    const credits = v.integer(`allocations.${i}.allocatedCredits`, row.allocatedCredits, "Classes", { min: 0, max: 500 });
    if (subjectId && seen.has(subjectId)) v.add(`allocations.${i}.subjectId`, "Each subject can be listed once.");
    seen.add(subjectId);
    if (credits > 0) allocations.push({ subjectId, allocatedCredits: credits });
  });
  const allocated = allocations.reduce((sum, a) => sum + a.allocatedCredits, 0);
  if (!v.errors.totalCredits && allocated !== totalCredits) {
    v.add("allocations", `Share all ${totalCredits} classes between the subjects (now ${allocated}).`);
  }
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

  return withCodeRetry(["package", "invoice"], () =>
    prisma.$transaction(
      async (tx) => {
        const options = await existingPaymentOptions(studentId, tx);
        if (!options) throw notFoundError("This student no longer exists. Refresh the page.");
        const enrolled = new Set(options.subjects.map((s) => s.subjectId));
        const notEnrolled = allocations.filter((a) => !enrolled.has(a.subjectId));
        if (options.subjects.length === 0) throw validationError("Add the student's subjects first (Subjects tab), then assign the package.");
        if (notEnrolled.length) throw validationError("Share the classes only between the student's current subjects. Refresh the page and try again.");

        const input = { name: name ?? "", totalCredits, price, startDate: startDate!, expiryDate, allocations };
        let result: AssignResult;

        if (type === "PACKAGE") {
          const pkg = options.unsetPackages.find((p) => p.id === sourceId);
          if (!pkg) throw conflictError("This package is already set up or no longer exists. Refresh the page.");
          await tx.studentPackage.update({
            where: { id: pkg.id },
            data: { name: name ?? pkg.name, totalCredits, startDate: startDate!, expiryDate },
          });
          await addPackageAllocations(tx, pkg.id, allocations, user, LEDGER_REASON);
          // Two people setting up the same package at once: only one set of allocations may exist.
          if ((await tx.subjectAllocation.count({ where: { packageId: pkg.id } })) !== allocations.length) {
            throw conflictError("Someone else set up this package at the same time. Refresh the page.");
          }
          result = { packageId: pkg.id, packageNumber: pkg.packageNumber, invoiceNumber: pkg.invoiceNumbers[0] ?? null, packageValue: pkg.price, paidFromExisting: pkg.paid, stillToPay: pkg.balanceDue, newPaymentCreated: 0 };
        } else if (type === "INVOICE") {
          const invoice = options.unlinkedInvoices.find((i) => i.id === sourceId);
          if (!invoice) throw conflictError("This invoice is already linked to a package or no longer exists. Refresh the page.");
          const created = await createPackageForStudent(
            tx,
            studentId,
            { ...input, name: name || `${totalCredits}-class package`, price: invoice.totalAmount },
            user,
            { createInvoice: false, ledgerReason: LEDGER_REASON }
          );
          const linked = await tx.invoice.updateMany({ where: { id: invoice.id, packageId: null }, data: { packageId: created.packageId } });
          if (linked.count !== 1) throw conflictError("This invoice was linked to a package at the same time. Refresh the page.");
          result = { packageId: created.packageId, packageNumber: created.packageNumber, invoiceNumber: invoice.invoiceNumber, packageValue: invoice.totalAmount, paidFromExisting: invoice.paidAmount, stillToPay: invoice.balanceDue, newPaymentCreated: 0 };
        } else {
          if (options.unusedTotal <= 0) throw conflictError("This student has no verified payment left to use. Refresh the page.");
          const created = await createPackageForStudent(
            tx,
            studentId,
            { ...input, name: name || `${totalCredits}-class package` },
            user,
            { createInvoice: false, ledgerReason: LEDGER_REASON }
          );
          // The package's invoice is settled from the existing payments (oldest first); no payment is created.
          const invoiceNumber = await nextCode(tx, "invoice");
          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              studentId,
              packageId: created.packageId,
              issueDate: new Date(),
              dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
              subtotal: price,
              discount: 0,
              totalAmount: price,
              paidAmount: 0,
              balanceDue: price,
              currency: "INR",
              status: "UNPAID",
              notes: "Package assigned using an existing payment; no new payment was created.",
              items: { create: [{ description: name || `${totalCredits}-class package`, quantity: 1, unitPrice: price, amount: price }] },
            },
          });
          let remaining = price;
          for (const payment of options.unusedPayments) {
            if (remaining <= 0) break;
            const take = Math.min(payment.unused, remaining);
            await tx.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: invoice.id, amount: take } });
            remaining -= take;
            // Never apply more than a payment is worth, even if another change raced this one.
            const used = await tx.paymentAllocation.aggregate({ where: { paymentId: payment.id }, _sum: { amount: true } });
            if ((used._sum.amount ?? 0) > payment.amount) throw conflictError("This payment was used for something else at the same time. Refresh the page.");
          }
          const paid = price - remaining;
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { paidAmount: paid, balanceDue: remaining, status: remaining === 0 ? "PAID" : "PARTIALLY_PAID" },
          });
          result = { packageId: created.packageId, packageNumber: created.packageNumber, invoiceNumber, packageValue: price, paidFromExisting: paid, stillToPay: remaining, newPaymentCreated: 0 };
        }

        await tx.auditLog.create({
          data: {
            entityType: "PACKAGE",
            entityId: result.packageId,
            action: "ASSIGN_PACKAGE_FROM_EXISTING_PAYMENT",
            actorRole: user.role,
            actorName: user.name,
            details: JSON.stringify({ studentCode: options.student.studentCode, source: type, ...result, totalCredits, allocations }),
          },
        });
        return result;
      },
      { timeout: 20000, maxWait: 10000 }
    )
  );
}
