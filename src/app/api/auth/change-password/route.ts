import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ApiError, readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { newPasswordProblem } from "@/lib/password-rules";

/**
 * Signed-in users change their own password (the current one is required).
 * Every existing session, including this one, is signed out afterwards.
 */
export const POST = withErrorHandling("POST /api/auth/change-password", async (req) => {
  const sessionUser = await requireUser();
  const body = await readJsonObject(req);
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  const problem = newPasswordProblem(newPassword);
  if (problem) throw validationError(problem, { newPassword: problem });
  if (newPassword === currentPassword) {
    throw validationError("Choose a new password that is different from the current one.", {
      newPassword: "Choose a different password.",
    });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  if (user.passwordHash && !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new ApiError(400, "VALIDATION_FAILED", "The current password is incorrect.", {
      fieldErrors: { currentPassword: "Incorrect password." },
    });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        inviteToken: null,
        inviteExpiresAt: null,
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "USER",
        entityId: user.id,
        action: "CHANGE_PASSWORD",
        actorRole: sessionUser.role,
        actorName: sessionUser.name,
        details: JSON.stringify({ email: user.email, otherSessionsSignedOut: true }),
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    message: "Password changed. All devices have been signed out; sign in again with the new password.",
  });
});
