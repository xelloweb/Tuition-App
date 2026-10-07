import { NextResponse } from "next/server";
import { canManageUsers, requirePermission, requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-errors";
import { issueResetLink, siteBase } from "@/lib/services/users";

type Ctx = { params: Promise<{ id: string }> };

/** Owner creates a password reset link: the current password stops working and sessions end. */
export const POST = withErrorHandling<Ctx>("POST /api/users/[id]/reset-link", async (req, { params }) => {
  const user = await requireUser();
  requirePermission(canManageUsers(user.role), "Only the owner can manage logins.");
  const { id } = await params;
  const result = await issueResetLink(id, user);
  return NextResponse.json({
    success: true,
    user: result.user,
    setupLink: `${siteBase(req)}/setup-password?token=${result.token}`,
    expiresAt: result.expiresAt,
  });
});
