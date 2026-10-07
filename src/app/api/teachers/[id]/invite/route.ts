import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { canManageTeachers, requirePermission, requireUser } from "@/lib/auth";
import { ApiError, notFoundError, withErrorHandling } from "@/lib/api-errors";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Creates (or refreshes) a trainer login invitation. The trainer profile itself
 * is independent: no email is sent here, the link is shown to staff to share.
 */
export const POST = withErrorHandling<Ctx>("POST /api/teachers/[id]/invite", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canManageTeachers(user.role), "Only the owner or an academic coordinator can invite trainers.");

  const { id } = await params;
  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) throw notFoundError("This trainer no longer exists. Refresh the page.");
  if (!teacher.active) throw new ApiError(409, "CONFLICT", "Reactivate this trainer before sending a login invitation.");

  const existingByEmail = await prisma.user.findUnique({ where: { email: teacher.email } });
  if (existingByEmail && existingByEmail.teacherId !== id) {
    throw new ApiError(409, "DUPLICATE", "Another login account already uses this trainer's email address.");
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.user.upsert({
    where: { teacherId: id },
    update: { inviteToken, inviteExpiresAt },
    create: {
      email: teacher.email,
      name: teacher.name,
      role: "TEACHER",
      teacherId: id,
      inviteToken,
      inviteExpiresAt,
    },
  });
  await prisma.auditLog.create({
    data: {
      entityType: "TEACHER",
      entityId: id,
      action: "INVITE_TEACHER_LOGIN",
      actorRole: user.role,
      actorName: user.name,
      details: JSON.stringify({ email: teacher.email, expiresAt: inviteExpiresAt }),
    },
  });

  // Prefer the configured public URL over request headers when building the link.
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host")}`;
  return NextResponse.json({ success: true, inviteLink: `${base}/setup-password?token=${inviteToken}`, expiresAt: inviteExpiresAt });
});
