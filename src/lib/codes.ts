import { Prisma, PrismaClient } from "@prisma/client";
import { uniqueTargetIncludes } from "./api-errors";
import { BUSINESS_TIME_ZONE } from "./constants";

type Db = PrismaClient | Prisma.TransactionClient;

export type CodeKind = "student" | "package" | "invoice" | "payment" | "payoutRun";

const PREFIX: Record<CodeKind, string> = {
  student: "XEL",
  package: "PKG",
  invoice: "INV",
  payment: "PAY",
  payoutRun: "PAYOUT",
};

const UNIQUE_FIELD: Record<CodeKind, string> = {
  student: "studentCode",
  package: "packageNumber",
  invoice: "invoiceNumber",
  payment: "paymentNumber",
  payoutRun: "runNumber",
};

const PAD: Record<CodeKind, number> = {
  student: 3,
  package: 3,
  invoice: 3,
  payment: 3,
  payoutRun: 2,
};

export function businessYear(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric" }).format(now);
}

async function existingCodes(db: Db, kind: CodeKind, prefix: string): Promise<string[]> {
  const where = { startsWith: prefix };
  switch (kind) {
    case "student":
      return (await db.student.findMany({ where: { studentCode: where }, select: { studentCode: true } })).map((r) => r.studentCode);
    case "package":
      return (await db.studentPackage.findMany({ where: { packageNumber: where }, select: { packageNumber: true } })).map((r) => r.packageNumber);
    case "invoice":
      return (await db.invoice.findMany({ where: { invoiceNumber: where }, select: { invoiceNumber: true } })).map((r) => r.invoiceNumber);
    case "payment":
      return (await db.payment.findMany({ where: { paymentNumber: where }, select: { paymentNumber: true } })).map((r) => r.paymentNumber);
    case "payoutRun":
      return (await db.payoutRun.findMany({ where: { runNumber: where }, select: { runNumber: true } })).map((r) => r.runNumber);
  }
}

/**
 * Next human-readable reference, e.g. XEL-2026-014. Based on the highest
 * existing number (not the row count), so deleted rows can never cause a
 * collision and numbers are never reused.
 */
export async function nextCode(db: Db, kind: CodeKind, now = new Date()): Promise<string> {
  const prefix = `${PREFIX[kind]}-${businessYear(now)}-`;
  let max = 0;
  for (const code of await existingCodes(db, kind, prefix)) {
    const suffix = code.slice(prefix.length);
    if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix));
  }
  return `${prefix}${String(max + 1).padStart(PAD[kind], "0")}`;
}

export function isCodeCollision(err: unknown, kinds: CodeKind[]): boolean {
  return kinds.some((kind) => uniqueTargetIncludes(err, UNIQUE_FIELD[kind]));
}

/**
 * Runs an atomic operation that allocates reference numbers and retries it
 * when a concurrent request claimed the same number. Each failed attempt is
 * fully rolled back by its transaction, so a retry cannot create duplicates.
 */
export async function withCodeRetry<T>(kinds: CodeKind[], operation: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (attempt >= attempts || !isCodeCollision(err, kinds)) throw err;
    }
  }
}
