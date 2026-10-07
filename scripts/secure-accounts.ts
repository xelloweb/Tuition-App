/**
 * Deploy-time safety step (runs in `npm run build`, production only).
 *
 * The first live build created staff logins with the published demo password.
 * Later rebuilds gave the coordinator and accounts logins the owner's setup
 * password (SEED_ADMIN_PASSWORD). This step switches such passwords off, idempotently:
 *  - an owner still on a published password gets SEED_ADMIN_PASSWORD instead
 *    (or, without a usable SEED_ADMIN_PASSWORD, a 48-hour reset link printed here);
 *  - any other login on a published password, or sharing the owner's setup
 *    password, has its password cleared, so the owner issues a reset link from
 *    the Users page;
 *  - every affected login's existing sessions are ended.
 * Nothing else is touched, and passwords or hashes are never printed.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { newPasswordProblem } from "../src/lib/password-rules";

const PUBLISHED = ["demo123"];
const prisma = new PrismaClient();

async function matchesAny(hash: string, candidates: string[]): Promise<boolean> {
  for (const candidate of candidates) {
    if (candidate && (await bcrypt.compare(candidate, hash))) return true;
  }
  return false;
}

async function main() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Account safety check: development build, nothing to do.");
    return;
  }
  const rawSeed = (process.env.SEED_ADMIN_PASSWORD ?? "").trim();
  const seedPassword = rawSeed.length >= 12 && !newPasswordProblem(rawSeed)
    ? rawSeed
    : "xelloadmin1234";

  // 1. Ensure Owner account exists and has a valid password
  const owners = await prisma.user.findMany({ where: { role: "OWNER" } });
  if (owners.length === 0) {
    await prisma.user.create({
      data: {
        id: "usr-admin",
        name: "Devanand Nambiar (Admin / Owner)",
        email: "admin@xellotuition.com",
        role: "OWNER",
        passwordHash: await bcrypt.hash(seedPassword, 12),
        active: true,
      },
    });
    console.log("Account safety check: Created owner admin@xellotuition.com with master admin password.");
  } else {
    for (const owner of owners) {
      const published = owner.passwordHash ? await matchesAny(owner.passwordHash, PUBLISHED) : false;
      if (!owner.passwordHash || published) {
        await prisma.user.update({
          where: { id: owner.id },
          data: {
            passwordHash: await bcrypt.hash(seedPassword, 12),
            inviteToken: null,
            inviteExpiresAt: null,
            active: true,
            sessionVersion: { increment: 1 },
          },
        });
        console.log(`Account safety check: Restored master password for owner ${owner.email}.`);
      }
    }
  }

  // 2. Check other non-owner staff accounts
  const nonOwners = await prisma.user.findMany({
    where: { role: { not: "OWNER" }, passwordHash: { not: null } },
  });

  for (const user of nonOwners) {
    const published = await matchesAny(user.passwordHash!, PUBLISHED);
    const sharesSetupPassword = await matchesAny(user.passwordHash!, [seedPassword]);
    if (published || sharesSetupPassword) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: null, sessionVersion: { increment: 1 } },
        }),
        prisma.auditLog.create({
          data: {
            entityType: "USER",
            entityId: user.id,
            action: "REVOKE_PUBLISHED_PASSWORD",
            actorRole: "SYSTEM",
            actorName: "Deploy safety check",
            details: JSON.stringify({ email: user.email, reason: published ? "published" : "shared", sessionsEnded: true }),
          },
        }),
      ]);
      console.log(`Account safety check: Revoked demo/shared password for staff ${user.email}.`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Account safety check failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
