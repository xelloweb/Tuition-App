import { NextResponse } from "next/server";
import { canManageUsers, requirePermission, requireUser } from "@/lib/auth";
import { readJsonObject, withErrorHandling } from "@/lib/api-errors";
import { createStaffLogin, siteBase } from "@/lib/services/users";

/** Owner creates a staff login; the response carries a one-time link to set its password (nothing is sent). */
export const POST = withErrorHandling("POST /api/users", async (req) => {
  const user = await requireUser();
  requirePermission(canManageUsers(user.role), "Only the owner can manage logins.");
  const result = await createStaffLogin(await readJsonObject(req), user);
  return NextResponse.json(
    {
      success: true,
      user: result.user,
      setupLink: `${siteBase(req)}/setup-password?token=${result.token}`,
      expiresAt: result.expiresAt,
    },
    { status: 201 }
  );
});
