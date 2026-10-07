import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { newPasswordProblem } from "@/lib/password-rules";

/**
 * Sets a password from a one-time invitation or reset token (public route; the
 * token is the credential). Any session signed with an older password ends.
 */
export const POST = withErrorHandling("POST /api/auth/setup-password", async (req) => {
  const body = await readJsonObject(req);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token) throw validationError("This link is incomplete. Ask the owner for a new one.");
  const problem = newPasswordProblem(password);
  if (problem) throw validationError(problem, { password: problem });

  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.active || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    throw new ApiError(400, "VALIDATION_FAILED", "This invitation link is invalid or has expired. Ask for a new one.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // Conditional update: the token can be used once, even if the form is submitted twice.
  const updated = await prisma.user.updateMany({
    where: { id: user.id, inviteToken: token },
    data: { passwordHash, inviteToken: null, inviteExpiresAt: null, sessionVersion: { increment: 1 } },
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
