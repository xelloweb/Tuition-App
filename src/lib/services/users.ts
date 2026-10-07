/**
 * Login management for the owner: staff logins, deactivation and one-time
 * password links. Nothing is emailed; links are shown to the owner to share.
 */
import crypto from "node:crypto";
import { Prisma, User } from "@prisma/client";
import { prisma } from "../prisma";
import { CurrentUser } from "../types";
import { ApiError, notFoundError, validationError } from "../api-errors";
import { FieldCollector } from "../validation";

export const STAFF_ROLES = ["OWNER", "COORDINATOR", "ACCOUNTS"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
const LINK_VALID_DAYS = 7;

export type LoginStatus = "ACTIVE" | "LINK_PENDING" | "NO_PASSWORD" | "DEACTIVATED";

type UserWithTrainer = User & { teacher: { name: string } | null };

export function loginStatus(user: User, now = new Date()): LoginStatus {
  if (!user.active) return "DEACTIVATED";
  if (user.passwordHash) return "ACTIVE";
  if (user.inviteToken && user.inviteExpiresAt && user.inviteExpiresAt > now) return "LINK_PENDING";
  return "NO_PASSWORD";
}

export function presentUser(user: UserWithTrainer, now = new Date()) {
  const status = loginStatus(user, now);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    status,
    linkExpiresAt: status === "LINK_PENDING" ? user.inviteExpiresAt!.toISOString() : null,
    trainerName: user.teacher?.name ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export type UserListItem = ReturnType<typeof presentUser>;

export async function listUsers(): Promise<UserListItem[]> {
  const users = await prisma.user.findMany({
    include: { teacher: { select: { name: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return users.map((u) => presentUser(u));
}

/** Public address used in links; prefers NEXTAUTH_URL over request headers. */
export function siteBase(req: Request): string {
  return (
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host")}`
  );
}

function newLinkToken() {
  return {
    inviteToken: crypto.randomBytes(32).toString("hex"),
    inviteExpiresAt: new Date(Date.now() + LINK_VALID_DAYS * 24 * 60 * 60 * 1000),
  };
}

async function assertEmailFree(tx: Prisma.TransactionClient, email: string, exceptId?: string) {
  const clash = await tx.user.findUnique({ where: { email } });
  if (clash && clash.id !== exceptId) {
    throw new ApiError(409, "DUPLICATE", "Another login already uses this email address.", {
      fieldErrors: { email: "Already used by another login." },
    });
  }
}

/** Refuses changes that would leave nobody able to manage the site. */
async function assertAnotherActiveOwner(tx: Prisma.TransactionClient, exceptId: string) {
  const owners = await tx.user.count({ where: { role: "OWNER", active: true, id: { not: exceptId } } });
  if (owners === 0) {
    throw new ApiError(409, "CONFLICT", "This is the only active owner login. Add another owner before changing it.");
  }
}

export async function createStaffLogin(body: Record<string, unknown>, actor: CurrentUser) {
  const v = new FieldCollector();
  const name = v.requiredText("name", body.name, "Name", 80);
  if (name && name.length < 2) v.add("name", "Name must be at least 2 characters.");
  const email = v.email("email", body.email, "Email address", true) ?? "";
  const role = v.oneOf("role", body.role, STAFF_ROLES, "Role");
  if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

  return prisma.$transaction(async (tx) => {
    await assertEmailFree(tx, email);
    const link = newLinkToken();
    const user = await tx.user.create({
      data: { name, email, role, active: true, passwordHash: null, ...link },
      include: { teacher: { select: { name: true } } },
    });
    await tx.auditLog.create({
      data: {
        entityType: "USER",
        entityId: user.id,
        action: "CREATE_LOGIN",
        actorRole: actor.role,
        actorName: actor.name,
        details: JSON.stringify({ name, email, role, linkExpiresAt: link.inviteExpiresAt }),
      },
    });
    return { user: presentUser(user), token: link.inviteToken, expiresAt: link.inviteExpiresAt };
  });
}

/**
 * Edits a login. Trainer logins only change their active state here (name and
 * email follow the trainer profile). Nobody can lock themselves out, and the
 * last active owner cannot be demoted or switched off.
 */
export async function updateLogin(id: string, body: Record<string, unknown>, actor: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id } });
    if (!existing) throw notFoundError("This login no longer exists. Refresh the page.");
    const isTrainerLogin = existing.role === "TEACHER";
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    const v = new FieldCollector();
    const data: Prisma.UserUpdateInput = {};

    if (!isTrainerLogin) {
      if (has("name")) {
        const name = v.requiredText("name", body.name, "Name", 80);
        if (name && name.length < 2) v.add("name", "Name must be at least 2 characters.");
        data.name = name;
      }
      if (has("email")) data.email = v.email("email", body.email, "Email address", true) ?? "";
      if (has("role")) data.role = v.oneOf("role", body.role, STAFF_ROLES, "Role");
    } else if (has("name") || has("email") || has("role")) {
      v.add("role", "Change a trainer's name or email on the Trainers page.");
    }
    if (has("active")) {
      if (typeof body.active !== "boolean") v.add("active", "Choose on or off.");
      else data.active = body.active;
    }
    if (v.hasErrors) throw validationError("Please correct the highlighted fields.", v.errors);

    const self = existing.id === actor.id;
    if (self && (data.active === false || (data.role && data.role !== existing.role))) {
      throw new ApiError(409, "CONFLICT", "You cannot switch off or change the role of your own login.");
    }
    const losesOwner = existing.role === "OWNER" && existing.active && (data.active === false || (data.role && data.role !== "OWNER"));
    if (losesOwner) await assertAnotherActiveOwner(tx, existing.id);
    if (typeof data.email === "string" && data.email !== existing.email) await assertEmailFree(tx, data.email, existing.id);

    // Switching a login off ends its sessions at once.
    if (data.active === false && existing.active) data.sessionVersion = { increment: 1 };
    const updated = await tx.user.update({ where: { id }, data, include: { teacher: { select: { name: true } } } });

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of ["name", "email", "role", "active"] as const) {
      if (existing[key] !== updated[key]) changes[key] = { from: existing[key], to: updated[key] };
    }
    if (Object.keys(changes).length) {
      await tx.auditLog.create({
        data: {
          entityType: "USER",
          entityId: id,
          action: data.active === false && existing.active ? "DEACTIVATE_LOGIN" : "UPDATE_LOGIN",
          actorRole: actor.role,
          actorName: actor.name,
          details: JSON.stringify({ email: updated.email, changes }),
        },
      });
    }
    return presentUser(updated);
  });
}

/**
 * Creates a one-time link to set a new password. The current password stops
 * working immediately and every session of that login ends.
 */
export async function issueResetLink(id: string, actor: CurrentUser) {
  if (id === actor.id) {
    throw new ApiError(409, "CONFLICT", "Change your own password under My Account.");
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id } });
    if (!existing) throw notFoundError("This login no longer exists. Refresh the page.");
    if (!existing.active) throw new ApiError(409, "CONFLICT", "Switch this login on before creating a reset link.");
    const link = newLinkToken();
    const updated = await tx.user.update({
      where: { id },
      data: { passwordHash: null, ...link, sessionVersion: { increment: 1 } },
      include: { teacher: { select: { name: true } } },
    });
    await tx.auditLog.create({
      data: {
        entityType: "USER",
        entityId: id,
        action: "ISSUE_RESET_LINK",
        actorRole: actor.role,
        actorName: actor.name,
        details: JSON.stringify({ email: existing.email, linkExpiresAt: link.inviteExpiresAt, previousPasswordRevoked: Boolean(existing.passwordHash) }),
      },
    });
    return { user: presentUser(updated), token: link.inviteToken, expiresAt: link.inviteExpiresAt };
  });
}
