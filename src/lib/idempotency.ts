import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { uniqueTargetIncludes } from "./api-errors";

type Db = PrismaClient | Prisma.TransactionClient;

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

/** Reads the optional Idempotency-Key header sent by the create forms. */
export function readIdempotencyKey(req: Request): string | null {
  const key = req.headers.get("idempotency-key")?.trim();
  return key && KEY_PATTERN.test(key) ? key : null;
}

const storageKey = (scope: string, key: string) => `${scope}:${key}`;

/** Returns the id of the record a previous request with this key created, if any. */
export async function findIdempotentEntity(scope: string, key: string | null): Promise<string | null> {
  if (!key) return null;
  const row = await prisma.idempotencyKey.findUnique({ where: { key: storageKey(scope, key) } });
  return row?.entityId ?? null;
}

/**
 * Must run inside the same transaction as the create, so the key and the
 * record are committed (or rolled back) together.
 */
export async function rememberIdempotentEntity(db: Db, scope: string, key: string | null, entityId: string) {
  if (!key) return;
  await db.idempotencyKey.create({ data: { key: storageKey(scope, key), scope, entityId } });
}

export function isIdempotencyCollision(err: unknown): boolean {
  return uniqueTargetIncludes(err, "key");
}

/**
 * Runs a create operation at most once per idempotency key. A replay (or a
 * concurrent duplicate that lost the race) returns the original record.
 */
export async function runIdempotent<T>(
  scope: string,
  key: string | null,
  create: () => Promise<T>,
  load: (entityId: string) => Promise<T | null>
): Promise<{ result: T; replayed: boolean }> {
  const existingId = await findIdempotentEntity(scope, key);
  if (existingId) {
    const existing = await load(existingId);
    if (existing) return { result: existing, replayed: true };
  }
  try {
    return { result: await create(), replayed: false };
  } catch (err) {
    if (key && isIdempotencyCollision(err)) {
      const winnerId = await findIdempotentEntity(scope, key);
      const winner = winnerId ? await load(winnerId) : null;
      if (winner) return { result: winner, replayed: true };
    }
    throw err;
  }
}
