import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ApiError, readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";

const MIN_PASSWORD_LENGTH = 10;

/** Signed-in users change their own password (the current one is required). */
export const POST = withErrorHandling("POST /api/auth/change-password", async (req) => {
  const sessionUser = await requireUser();
  const body = await readJsonObject(req);
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 200) {
    throw validationError(`Use a new password of at least ${MIN_PASSWORD_LENGTH} characters.`, {
      newPassword: `At least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }
  if (newPassword === currentPassword || newPassword.toLowerCase() === "demo123") {
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

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), inviteToken: null, inviteExpiresAt: null },
  });
  await prisma.auditLog.create({
    data: {
      entityType: "USER",
      entityId: user.id,
      action: "CHANGE_PASSWORD",
      actorRole: sessionUser.role,
      actorName: sessionUser.name,
      details: JSON.stringify({ email: user.email }),
    },
  });

  return NextResponse.json({ success: true, message: "Password changed. Use the new password next time you sign in." });
});
