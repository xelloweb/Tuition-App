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
  const seedPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
  const seedUsable = seedPassword.length >= 12 && !newPasswordProblem(seedPassword);
  const users = await prisma.user.findMany({ where: { passwordHash: { not: null } } });
  const affected = [];
  for (const user of users) {
    const published = await matchesAny(user.passwordHash!, PUBLISHED);
    // Staff other than the owner must never share the owner's setup password.
    const sharesSetupPassword = user.role !== "OWNER" && seedUsable && (await matchesAny(user.passwordHash!, [seedPassword]));
    if (published || sharesSetupPassword) affected.push({ ...user, reason: published ? "published" : "shared" });
  }
  if (affected.length === 0) {
    console.log("Account safety check: no login uses a published or shared setup password.");
    return;
  }
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");

  for (const user of affected) {
    if (user.role === "OWNER" && seedUsable) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await bcrypt.hash(seedPassword, 12),
            inviteToken: null,
            inviteExpiresAt: null,
            sessionVersion: { increment: 1 },
          },
        }),
        prisma.auditLog.create({
          data: {
            entityType: "USER",
            entityId: user.id,
            action: "REPLACE_PUBLISHED_PASSWORD",
            actorRole: "SYSTEM",
            actorName: "Deploy safety check",
            details: JSON.stringify({ email: user.email, replacedWith: "SEED_ADMIN_PASSWORD", sessionsEnded: true }),
          },
        }),
      ]);
      console.log(`Account safety check: ${user.email} (owner) now uses the SEED_ADMIN_PASSWORD value; old sessions ended.`);
      continue;
    }

    const isOwner = user.role === "OWNER";
    const inviteToken = isOwner ? crypto.randomBytes(32).toString("hex") : null;
    const inviteExpiresAt = isOwner ? new Date(Date.now() + 48 * 60 * 60 * 1000) : null;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: null, inviteToken, inviteExpiresAt, sessionVersion: { increment: 1 } },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "USER",
          entityId: user.id,
          action: "REVOKE_PUBLISHED_PASSWORD",
          actorRole: "SYSTEM",
          actorName: "Deploy safety check",
          details: JSON.stringify({ email: user.email, reason: user.reason, resetLinkIssued: isOwner, sessionsEnded: true }),
        },
      }),
    ]);
    if (isOwner) {
      console.log(
        `Account safety check: ${user.email} (owner) used a published password. Set a new one within 48 hours at ${base || "<site address>"}/setup-password?token=${inviteToken}`
      );
    } else {
      const why = user.reason === "published" ? "used a published password" : "shared the owner's setup password";
      console.log(
        `Account safety check: ${user.email} ${why}; it no longer works. The owner can create a reset link on the Users page.`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error("Account safety check failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
