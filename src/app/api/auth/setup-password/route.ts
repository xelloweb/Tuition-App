import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";

const MIN_PASSWORD_LENGTH = 10;

/** Sets a password from a one-time invitation token (public route; the token is the credential). */
export const POST = withErrorHandling("POST /api/auth/setup-password", async (req) => {
  const body = await readJsonObject(req);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token) throw validationError("This invitation link is incomplete. Ask for a new one.");
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    throw validationError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`, {
      password: `At least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.active || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    throw new ApiError(400, "VALIDATION_FAILED", "This invitation link is invalid or has expired. Ask for a new one.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // Conditional update: the token can be used once, even if the form is submitted twice.
  const updated = await prisma.user.updateMany({
    where: { id: user.id, inviteToken: token },
    data: { passwordHash, inviteToken: null, inviteExpiresAt: null },
  });
  if (updated.count !== 1) {
    throw new ApiError(400, "VALIDATION_FAILED", "This invitation link has already been used.");
  }
  await prisma.auditLog.create({
    data: {
      entityType: "USER",
      entityId: user.id,
      action: "SET_PASSWORD_FROM_INVITE",
      actorRole: user.role,
      actorName: user.name,
      details: JSON.stringify({ email: user.email }),
    },
  });

  return NextResponse.json({ success: true });
});
