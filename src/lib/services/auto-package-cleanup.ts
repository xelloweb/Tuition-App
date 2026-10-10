/**
 * Owner-only cleanup of packages that were created automatically from payment
 * records, so staff can assign the right package with "Assign Package Using
 * Existing Payment" instead.
 *
 * Two origins, each proven from the records themselves (never from the date):
 *  - IMPORT: the 8 Oct 2026 student import made one package per student from
 *    their payment record: package PKG-<student code> (notes "Starting date:"),
 *    linked to invoice INV-<student code> ("Paid via Demo Admission").
 *  - EDIT_FORM: from 9 Oct 2026 the Edit Student form switched itself to
 *    "assign from existing payment" and saving any edit created a package. Such
 *    a package has both an UPDATE_STUDENT audit entry naming it as the new
 *    package and an ASSIGN_PACKAGE_FROM_EXISTING_PAYMENT entry. A package set
 *    up with the Assign button has only the latter and is never touched.
 *
 * Removing one deletes the package with its subject allocations, credit
 * history and booked classes that were never attended. Payments are never
 * changed: the imported paid invoice is unlinked from the package (it then
 * shows as paid money to assign); an invoice the form created for the
 * package is removed with its payment links, so those payments are unused
 * again. Kept (listed with the reason): packages with attended classes, ones
 * staff changed with Edit Package or set up with the Assign button, and any
 * whose origin cannot be confirmed. Each removal is its own transaction and
 * its audit entry holds a backup of every removed row.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { conflictError, forbiddenError, validationError } from "../api-errors";
import { PurgeTable, insertMissingRows } from "./student-purge";

type Db = PrismaClient | Prisma.TransactionClient;
type Row = Record<string, unknown>;

export const IMPORT_INVOICE_NOTE = "Paid via Demo Admission";
export const FORM_INVOICE_NOTE = "Package assigned using an existing payment; no new payment was created.";
export const CONFIRM_WORD = "REMOVE";

export type AutoOrigin = "IMPORT" | "EDIT_FORM";

export interface AutoPackage {
  packageId: string;
  packageNumber: string;
  packageName: string;
  status: string;
  createdAt: string;
  student: { id: string; name: string; studentCode: string };
  origin: AutoOrigin;
  /** What happens to the money: the paid invoice is unlinked, or the form's invoice is removed (payments unused again). */
  invoice: { invoiceNumber: string; action: "UNLINK" | "REMOVE"; paidAmount: number } | null;
  bookedClasses: number;
  attendedClasses: number;
  /** After removal the student has no other active package ("No Active Package"). */
  onlyPackage: boolean;
  /** Why it is kept; null when it can be removed. */
  keepReason: string | null;
}

export interface AutoPackageReview {
  removable: AutoPackage[];
  kept: AutoPackage[];
}

const parse = (json: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};
const isAttended = (s: { status: string; isCreditConsumed: boolean; attendance: unknown }) =>
  Boolean(s.attendance) || s.isCreditConsumed || s.status === "COMPLETED";
const isAttendedRow = (s: { status: string; isCreditConsumed: boolean }) => s.isCreditConsumed || s.status === "COMPLETED";

/** Every package of automatic origin (optionally only some), with what removing it would do. */
async function examine(db: Db, onlyIds?: string[]): Promise<AutoPackage[]> {
  const assignAudits = await db.auditLog.findMany({
    where: { action: "ASSIGN_PACKAGE_FROM_EXISTING_PAYMENT", ...(onlyIds ? { entityId: { in: onlyIds } } : {}) },
    select: { entityId: true, details: true },
  });
  const formAudits = await db.auditLog.findMany({
    where: { action: "UPDATE_STUDENT", details: { contains: '"newPackage"' } },
    select: { details: true },
  });
  const viaForm = new Set(
    formAudits
      .map((a) => ((parse(a.details).changes as Record<string, { to?: { packageId?: string } }> | undefined)?.newPackage?.to?.packageId ?? null))
      .filter((id): id is string => Boolean(id))
  );
  const assignsByPackage = new Map<string, { source: string; invoiceNumber: string | null; viaForm: boolean }[]>();
  for (const a of assignAudits) {
    const d = parse(a.details);
    const list = assignsByPackage.get(a.entityId) ?? [];
    list.push({ source: String(d.source ?? ""), invoiceNumber: typeof d.invoiceNumber === "string" ? d.invoiceNumber : null, viaForm: viaForm.has(a.entityId) });
    assignsByPackage.set(a.entityId, list);
  }

  const candidateIds = new Set<string>([...assignsByPackage.entries()].filter(([, l]) => l.some((x) => x.viaForm)).map(([id]) => id));
  const imported = await db.studentPackage.findMany({
    where: { packageNumber: { startsWith: "PKG-XEL-" }, ...(onlyIds ? { id: { in: onlyIds } } : {}) },
    select: { id: true },
  });
  for (const p of imported) candidateIds.add(p.id);
  if (!candidateIds.size) return [];

  const packages = await db.studentPackage.findMany({
    where: { id: { in: [...candidateIds] } },
    include: {
      student: { select: { id: true, name: true, studentCode: true } },
      invoices: { select: { id: true, invoiceNumber: true, notes: true, paidAmount: true, studentId: true } },
      allocations: { select: { id: true } },
      sessions: { select: { id: true, status: true, isCreditConsumed: true, attendance: { select: { id: true } } } },
    },
    orderBy: [{ createdAt: "asc" }],
  });
  const edited = new Set(
    (await db.auditLog.findMany({ where: { action: "EDIT_PACKAGE", entityId: { in: [...candidateIds] } }, select: { entityId: true } })).map((a) => a.entityId)
  );
  const otherActive = await db.studentPackage.groupBy({
    by: ["studentId"],
    where: { studentId: { in: packages.map((p) => p.studentId) }, status: "ACTIVE", id: { notIn: [...candidateIds] } },
    _count: true,
  });
  const hasOther = new Set(otherActive.map((o) => o.studentId));

  const out: AutoPackage[] = [];
  for (const p of packages) {
    const code = p.student.studentCode;
    const assigns = assignsByPackage.get(p.id) ?? [];
    const formAssign = assigns.find((a) => a.viaForm);
    const buttonAssign = assigns.some((a) => !a.viaForm);
    const importInvoice = p.invoices.find((i) => i.invoiceNumber === `INV-${code}` && (i.notes ?? "").startsWith(IMPORT_INVOICE_NOTE));
    const looksImported = p.packageNumber === `PKG-${code}` && (p.notes ?? "").startsWith("Starting date:") && Boolean(importInvoice);

    let origin: AutoOrigin | null = null;
    let invoice: AutoPackage["invoice"] = null;
    let keepReason: string | null = null;

    if (looksImported) {
      origin = "IMPORT";
      invoice = { invoiceNumber: importInvoice!.invoiceNumber, action: "UNLINK", paidAmount: importInvoice!.paidAmount };
      if (p.invoices.length !== 1) keepReason = "Another invoice is also linked to this package.";
      else if (p.allocations.length && !formAssign) keepReason = buttonAssign ? "Set up by staff with Assign Package Using Existing Payment." : "Its classes were set up by staff after the import.";
    } else if (formAssign) {
      origin = "EDIT_FORM";
      const formInvoice = p.invoices.find((i) => i.invoiceNumber === formAssign.invoiceNumber);
      if (formAssign.source === "PAYMENTS" && formInvoice && formInvoice.notes === FORM_INVOICE_NOTE && formInvoice.studentId === p.studentId) {
        invoice = { invoiceNumber: formInvoice.invoiceNumber, action: "REMOVE", paidAmount: formInvoice.paidAmount };
      } else if (formAssign.source === "INVOICE" && formInvoice) {
        invoice = { invoiceNumber: formInvoice.invoiceNumber, action: "UNLINK", paidAmount: formInvoice.paidAmount };
      } else {
        keepReason = "Could not confirm how this package was created.";
      }
      if (!keepReason && p.invoices.length !== 1) keepReason = "Another invoice is also linked to this package.";
    } else if (p.packageNumber.startsWith("PKG-XEL-")) {
      origin = "IMPORT";
      keepReason = "Looks imported, but its invoice or notes were changed, so its origin cannot be confirmed.";
    }
    if (!origin) continue;

    const attended = p.sessions.filter(isAttended).length;
    if (!keepReason && edited.has(p.id)) keepReason = "Changed by staff with Edit Package.";
    if (!keepReason && attended) keepReason = `${attended} attended class${attended === 1 ? "" : "es"} use this package. Correct it with Edit Package instead.`;

    out.push({
      packageId: p.id,
      packageNumber: p.packageNumber,
      packageName: p.name,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      student: p.student,
      origin,
      invoice,
      bookedClasses: p.sessions.length - attended,
      attendedClasses: attended,
      onlyPackage: !hasOther.has(p.studentId),
      keepReason,
    });
  }
  return out;
}

export async function reviewAutoPackages(db: Db = prisma): Promise<AutoPackageReview> {
  const all = await examine(db);
  return { removable: all.filter((a) => !a.keepReason), kept: all.filter((a) => a.keepReason) };
}

/** Every row a removal changes, as they are now. */
async function rowsFor(db: Db, item: AutoPackage) {
  const removeInvoice = item.invoice?.action === "REMOVE";
  const invoice = item.invoice ? await db.invoice.findUnique({ where: { invoiceNumber: item.invoice.invoiceNumber } }) : null;
  const sessions = await db.session.findMany({ where: { packageId: item.packageId } });
  const tables: Partial<Record<PurgeTable, Row[]>> = {
    StudentPackage: await db.studentPackage.findMany({ where: { id: item.packageId } }),
    SubjectAllocation: await db.subjectAllocation.findMany({ where: { packageId: item.packageId } }),
    CreditLedger: await db.creditLedger.findMany({ where: { packageId: item.packageId } }),
    Session: sessions,
    Invoice: invoice ? [invoice] : [],
    InvoiceLineItem: removeInvoice && invoice ? await db.invoiceLineItem.findMany({ where: { invoiceId: invoice.id } }) : [],
    InvoiceInstalment: removeInvoice && invoice ? await db.invoiceInstalment.findMany({ where: { invoiceId: invoice.id } }) : [],
    PaymentAllocation: removeInvoice && invoice ? await db.paymentAllocation.findMany({ where: { invoiceId: invoice.id } }) : [],
    FollowUp: await db.followUp.findMany({ where: { OR: [{ packageId: item.packageId }, ...(removeInvoice && invoice ? [{ invoiceId: invoice.id }] : [])] } }),
  };
  return { tables, invoice, sessions };
}

export interface AutoPackageBackup {
  format: "xello-auto-package-backup";
  version: 1;
  createdAt: string;
  createdBy: string;
  packages: { item: AutoPackage; tables: Partial<Record<PurgeTable, Row[]>> }[];
}

/** Backup of every removable package, downloaded before removing. */
export async function buildAutoPackageBackup(user: CurrentUser, db: Db = prisma): Promise<AutoPackageBackup> {
  const { removable } = await reviewAutoPackages(db);
  const packages = [];
  for (const item of removable) packages.push({ item, tables: (await rowsFor(db, item)).tables });
  return { format: "xello-auto-package-backup", version: 1, createdAt: new Date().toISOString(), createdBy: user.name, packages };
}

async function removeOne(packageId: string, user: CurrentUser) {
  return prisma.$transaction(
    async (tx) => {
      const [item] = await examine(tx, [packageId]);
      if (!item) throw conflictError("This package is no longer one that was created automatically.");
      if (item.keepReason) throw conflictError(item.keepReason);
      const { tables, invoice, sessions } = await rowsFor(tx, item);
      if (sessions.some(isAttendedRow)) throw conflictError("A class on this package was attended meanwhile.");

      await tx.session.deleteMany({ where: { id: { in: sessions.map((s) => s.id) } } });
      if (invoice && item.invoice?.action === "UNLINK") {
        const unlinked = await tx.invoice.updateMany({ where: { id: invoice.id, packageId }, data: { packageId: null } });
        if (unlinked.count !== 1) throw conflictError("The package's invoice changed meanwhile.");
      }
      await tx.followUp.updateMany({ where: { packageId }, data: { packageId: null } });
      if (invoice && item.invoice?.action === "REMOVE") {
        await tx.followUp.updateMany({ where: { invoiceId: invoice.id }, data: { invoiceId: null } });
        await tx.paymentAllocation.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.invoice.delete({ where: { id: invoice.id } });
      }
      await tx.studentPackage.delete({ where: { id: packageId } });

      await tx.auditLog.create({
        data: {
          entityType: "PACKAGE",
          entityId: packageId,
          action: "AUTO_PACKAGE_REMOVED",
          actorRole: user.role,
          actorName: user.name,
          // retiredNumbers are never issued again (see nextCode); backup restores the rows.
          details: JSON.stringify({
            studentCode: item.student.studentCode,
            packageNumber: item.packageNumber,
            origin: item.origin,
            invoice: item.invoice,
            bookedClassesRemoved: sessions.length,
            retiredNumbers: [item.packageNumber, ...(item.invoice?.action === "REMOVE" ? [item.invoice.invoiceNumber] : [])],
            backup: tables,
          }),
        },
      });
      return item;
    },
    { timeout: 30000, maxWait: 10000 }
  );
}

/** Removes every package the review lists as removable: body { confirm: "REMOVE" }. */
export async function removeAutoPackages(body: Record<string, unknown>, user: CurrentUser) {
  if (user.role !== "OWNER") throw forbiddenError("Only the owner can remove automatically created packages.");
  if (typeof body.confirm !== "string" || body.confirm.trim().toUpperCase() !== CONFIRM_WORD) {
    throw validationError(`Type ${CONFIRM_WORD} to confirm.`, { confirm: `Type ${CONFIRM_WORD} to confirm.` });
  }
  const { removable } = await reviewAutoPackages();
  const removed: AutoPackage[] = [];
  const skipped: { packageNumber: string; studentCode: string; reason: string }[] = [];
  for (const item of removable) {
    try {
      removed.push(await removeOne(item.packageId, user));
    } catch (err) {
      skipped.push({ packageNumber: item.packageNumber, studentCode: item.student.studentCode, reason: err instanceof Error ? err.message : "Could not remove." });
    }
  }
  if (removed.length) {
    await prisma.auditLog.create({
      data: {
        entityType: "PACKAGE",
        entityId: "auto-created-packages",
        action: "AUTO_PACKAGES_CLEANUP",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ removed: removed.map((r) => r.packageNumber), skipped }),
      },
    });
  }
  return {
    removed: removed.length,
    noActivePackage: removed.filter((r) => r.onlyPackage).length,
    skipped,
    message: `${removed.length} automatically created package${removed.length === 1 ? "" : "s"} removed. Payments are unchanged.${skipped.length ? ` ${skipped.length} could not be removed.` : ""}`,
  };
}

/** Puts removed packages back from a downloaded backup (for a one-time script if ever needed). */
export async function restoreAutoPackageBackup(backup: AutoPackageBackup, db: PrismaClient = prisma) {
  if (backup?.format !== "xello-auto-package-backup" || backup.version !== 1) throw validationError("This is not an automatic-package backup file.");
  return db.$transaction(async (tx) => {
    let restored = 0;
    for (const { tables } of backup.packages) {
      for (const table of ["StudentPackage", "SubjectAllocation", "CreditLedger", "Session", "Invoice", "InvoiceLineItem", "InvoiceInstalment", "PaymentAllocation"] as PurgeTable[]) {
        restored += await insertMissingRows(tx, table, tables[table] ?? []);
      }
      for (const inv of tables.Invoice ?? []) {
        await tx.invoice.updateMany({
          where: { id: inv.id as string, packageId: null },
          data: { packageId: inv.packageId as string | null, updatedAt: new Date(inv.updatedAt as string) },
        });
      }
      for (const f of tables.FollowUp ?? []) {
        await tx.followUp.updateMany({
          where: { id: f.id as string },
          data: { packageId: f.packageId as string | null, invoiceId: f.invoiceId as string | null, updatedAt: new Date(f.updatedAt as string) },
        });
      }
    }
    return restored;
  }, { timeout: 30000, maxWait: 10000 });
}
