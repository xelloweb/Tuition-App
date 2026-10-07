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
 *
 * It also runs a one-time response to the 7–8 Oct 2026 exposure (a fixed owner
 * password in the public code and an unauthenticated password-reset endpoint),
 * and lets the owner recover a forgotten password from Hostinger only
 * (OWNER_PASSWORD_RESET=reset-owner-password plus a new SEED_ADMIN_PASSWORD).
 * Nothing else is touched, and passwords or hashes are never printed.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PUBLISHED_PASSWORD_LIST, newPasswordProblem } from "../src/lib/password-rules";

const prisma = new PrismaClient();

/** Marks the one-time security reset as done (one audit row). */
const INCIDENT_ACTION = "SECURITY_RESET_2026_10_08";
/** 23:30 IST on 7 Oct 2026, before the first deploy that exposed the owner account. */
const INCIDENT_WINDOW_START = new Date("2026-10-07T18:00:00Z");
/** Deliberate phrase, like ALLOW_DB_RESET, so the reset never happens by accident. */
const OWNER_RESET_PHRASE = "reset-owner-password";
const LINK_HOURS = 48;

async function matchesAny(hash: string, candidates: string[]): Promise<boolean> {
  for (const candidate of candidates) {
    if (candidate && (await bcrypt.compare(candidate, hash))) return true;
  }
  return false;
}


const oneTimeLink = () => ({
  inviteToken: crypto.randomBytes(32).toString("hex"),
  inviteExpiresAt: new Date(Date.now() + LINK_HOURS * 60 * 60 * 1000),
});

/**
 * Anyone could sign in as the owner or reset any password while the exposed
 * code was live, so: every session ends; the owner gets a password only the
 * Hostinger account holder knows; logins changed during the window lose their
 * password (the owner sends fresh links). Runs once.
 */
async function respondToIncident(seedPassword: string, seedUsable: boolean, base: string) {
  if (await prisma.auditLog.findFirst({ where: { action: INCIDENT_ACTION } })) return;

  const users = await prisma.user.findMany();
  const ownerHash = seedUsable ? await bcrypt.hash(seedPassword, 12) : null;
  const ownerLinks: { email: string; token: string }[] = [];
  let staffCleared = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const user of users) {
        if (user.role === "OWNER") {
          if (ownerHash) {
            await tx.user.update({
              where: { id: user.id },
              data: { passwordHash: ownerHash, inviteToken: null, inviteExpiresAt: null, sessionVersion: { increment: 1 } },
            });
          } else {
            const link = oneTimeLink();
            await tx.user.update({ where: { id: user.id }, data: { passwordHash: null, ...link, sessionVersion: { increment: 1 } } });
            ownerLinks.push({ email: user.email, token: link.inviteToken });
          }
        } else if (user.updatedAt >= INCIDENT_WINDOW_START) {
          await tx.user.update({
            where: { id: user.id },
            data: { passwordHash: null, inviteToken: null, inviteExpiresAt: null, sessionVersion: { increment: 1 } },
          });
          staffCleared++;
        } else {
          await tx.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
        }
      }
      await tx.auditLog.create({
        data: {
          entityType: "SYSTEM",
          entityId: "security",
          action: INCIDENT_ACTION,
          actorRole: "SYSTEM",
          actorName: "Deploy safety check",
          details: JSON.stringify({
            reason: "Fixed owner password and open password reset were public on 7–8 Oct 2026",
            sessionsEnded: users.length,
            ownerPassword: ownerHash ? "replaced with SEED_ADMIN_PASSWORD" : "cleared; one-time link issued",
            staffPasswordsCleared: staffCleared,
            changedSince: INCIDENT_WINDOW_START.toISOString(),
          }),
        },
      });
    },
    { timeout: 60_000 }
  );

  console.log(`Security reset: all ${users.length} logins were signed out.`);
  if (ownerHash) console.log("Security reset: the owner now signs in with the SEED_ADMIN_PASSWORD value.");
  for (const link of ownerLinks) {
    console.log(`Security reset: ${link.email} (owner) must set a new password within ${LINK_HOURS} hours at ${base || "<site address>"}/setup-password?token=${link.token}`);
  }
  if (staffCleared) {
    console.log(`Security reset: ${staffCleared} staff or trainer login(s) changed since 23:30 IST on 7 Oct now need a new password link from the Users page.`);
  }
}

/** Owner recovery that needs Hostinger access, never a public web form. */
async function recoverOwner(seedPassword: string, seedUsable: boolean) {
  if (process.env.OWNER_PASSWORD_RESET !== OWNER_RESET_PHRASE) return;
  if (!seedUsable) {
    console.log("Owner password reset requested, but SEED_ADMIN_PASSWORD is missing, shorter than 12 characters or publicly known. Nothing changed.");
    return;
  }
  const owners = await prisma.user.findMany({ where: { role: "OWNER" } });
  const passwordHash = await bcrypt.hash(seedPassword, 12);
  for (const owner of owners) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: owner.id },
        data: { passwordHash, inviteToken: null, inviteExpiresAt: null, sessionVersion: { increment: 1 } },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "USER",
          entityId: owner.id,
          action: "OWNER_PASSWORD_RESET_FROM_HOSTING",
          actorRole: "SYSTEM",
          actorName: "Deploy safety check",
          details: JSON.stringify({ email: owner.email, sessionsEnded: true }),
        },
      }),
    ]);
  }
  console.log(
    `Owner password reset: ${owners.length} owner login(s) now use the SEED_ADMIN_PASSWORD value. Remove OWNER_PASSWORD_RESET in Hostinger now, then change the password under My account.`
  );
}

async function main() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Account safety check: development build, nothing to do.");
    return;
  }
  const seedPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
  const seedUsable = seedPassword.length >= 12 && !newPasswordProblem(seedPassword);
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");

  await respondToIncident(seedPassword, seedUsable, base);
  await recoverOwner(seedPassword, seedUsable);

  const users = await prisma.user.findMany({ where: { passwordHash: { not: null } } });
  const affected = [];
  for (const user of users) {
    const published = await matchesAny(user.passwordHash!, PUBLISHED_PASSWORD_LIST);
    // Staff other than the owner must never share the owner's setup password.
    const sharesSetupPassword = user.role !== "OWNER" && seedUsable && (await matchesAny(user.passwordHash!, [seedPassword]));
    if (published || sharesSetupPassword) affected.push({ ...user, reason: published ? "published" : "shared" });
  }
  if (affected.length === 0) {
    console.log("Account safety check: no login uses a published or shared setup password.");
    return;
  }

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
    const link = isOwner ? oneTimeLink() : { inviteToken: null, inviteExpiresAt: null };
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: null, ...link, sessionVersion: { increment: 1 } },
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
        `Account safety check: ${user.email} (owner) used a published password. Set a new one within ${LINK_HOURS} hours at ${base || "<site address>"}/setup-password?token=${link.inviteToken}`
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
