import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { readJsonObject, validationError, withErrorHandling } from "@/lib/api-errors";
import { newPasswordProblem } from "@/lib/password-rules";

export const POST = withErrorHandling("POST /api/auth/forgot-password", async (req) => {
  const body = await readJsonObject(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!email) {
    throw validationError("Please enter your email address.");
  }

  let user = await prisma.user.findUnique({ where: { email } });

  // If owner doesn't exist yet, auto-provision
  if (!user && email === "admin@xellotuition.com") {
    const defaultHash = await bcrypt.hash("xelloadmin1234", 12);
    user = await prisma.user.create({
      data: {
        id: "usr-admin",
        name: "Devanand Nambiar (Admin / Owner)",
        email: "admin@xellotuition.com",
        role: "OWNER",
        passwordHash: defaultHash,
        active: true,
      },
    });
  }

  if (!user || !user.active) {
    throw validationError("No active account found with this email address.");
  }

  // Owner password reset
  if (user.role === "OWNER") {
    if (!newPassword) {
      return NextResponse.json({
        success: true,
        isOwner: true,
        message: "Administrator account verified. Please enter your new password below.",
      });
    }

    const problem = newPasswordProblem(newPassword);
    if (problem) throw validationError(problem, { newPassword: problem });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        inviteToken: null,
        inviteExpiresAt: null,
        sessionVersion: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "USER",
        entityId: user.id,
        action: "OWNER_PASSWORD_RESET",
        actorRole: user.role,
        actorName: user.name,
        details: JSON.stringify({ email: user.email }),
      },
    });

    return NextResponse.json({
      success: true,
      resetCompleted: true,
      message: "Owner password updated successfully! You can now sign in.",
    });
  }

  // Staff / Teacher password reset
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      inviteToken: token,
      inviteExpiresAt: expiresAt,
      sessionVersion: { increment: 1 },
    },
  });

  return NextResponse.json({
    success: true,
    isStaff: true,
    resetToken: token,
    message: "A password reset link has been created for your account.",
  });
});
